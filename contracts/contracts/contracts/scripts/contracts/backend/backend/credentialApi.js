const express = require('express');
const ethers = require('ethers');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Environment Variables
const INFURA_API_KEY = process.env.INFURA_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

// Initialize Provider and Signer
const provider = new ethers.providers.InfuraProvider('sepolia', INFURA_API_KEY);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Contract ABI
const CONTRACT_ABI = [
  'function issueCredential(address _holder, string _credentialType, string _credentialName, string _description, uint256 _expiryDate, string _ipfsHash) public returns (bytes32)',
  'function verifyCredential(bytes32 _credentialId) public view returns (bool, string)',
  'function getCredential(bytes32 _credentialId) public view returns (tuple(bytes32, address, address, string, string, string, uint256, uint256, string, bool))',
  'function getHolderCredentials(address _holder) public view returns (bytes32[])',
  'function registerHolder(string _name, string _email, string _profileIpfsHash) public',
  'function authorizeIssuer(address issuer) public'
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// IPFS Functions
async function uploadToIPFS(data) {
  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      data,
      {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      }
    );
    return response.data.IpfsHash;
  } catch (error) {
    console.error('IPFS upload error:', error);
    throw new Error('Failed to upload to IPFS');
  }
}

async function fetchFromIPFS(ipfsHash) {
  try {
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
    return response.data;
  } catch (error) {
    console.error('IPFS fetch error:', error);
    throw new Error('Failed to fetch from IPFS');
  }
}

// Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name } = req.body;
    const token = jwt.sign({ email, name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, message: 'Registration successful' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, message: 'Login successful' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/holders/register', authenticateToken, async (req, res) => {
  try {
    const { name, email, address } = req.body;

    const profileData = { name, email, registeredAt: new Date().toISOString() };
    const ipfsHash = await uploadToIPFS(profileData);

    const tx = await contract.registerHolder(name, email, ipfsHash);
    await tx.wait();

    res.json({
      message: 'Holder registered successfully',
      address,
      ipfsHash,
      transactionHash: tx.hash
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/holders/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const holder = await contract.getHolderProfile(address);
    const credentials = await contract.getHolderCredentials(address);

    res.json({
      holder: {
        address: holder.holderAddress,
        name: holder.name,
        email: holder.email,
        memberSince: new Date(holder.memberSince.toNumber() * 1000),
        credentialCount: holder.credentialCount.toNumber()
      },
      credentials
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/credentials/issue', authenticateToken, async (req, res) => {
  try {
    const { holderAddress, credentialType, credentialName, description, expiryDate } = req.body;

    if (!ethers.utils.isAddress(holderAddress)) {
      return res.status(400).json({ error: 'Invalid holder address' });
    }

    const credentialData = {
      credentialType,
      credentialName,
      description,
      issuedBy: req.user.email,
      issuedAt: new Date().toISOString()
    };
    const ipfsHash = await uploadToIPFS(credentialData);

    const tx = await contract.issueCredential(
      holderAddress,
      credentialType,
      credentialName,
      description,
      Math.floor(new Date(expiryDate).getTime() / 1000),
      ipfsHash
    );

    const receipt = await tx.wait();

    res.json({
      message: 'Credential issued successfully',
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      ipfsHash
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/credentials/:credentialId/verify', async (req, res) => {
  try {
    const { credentialId } = req.params;

    const [isValid, reason] = await contract.verifyCredential(credentialId);
    const credential = await contract.getCredential(credentialId);
    const credentialDetails = await fetchFromIPFS(credential.ipfsHash);

    res.json({
      credentialId,
      isValid,
      reason,
      credential: {
        type: credential.credentialType,
        name: credential.credentialName,
        issuer: credential.issuer,
        holder: credential.holder,
        issuanceDate: new Date(credential.issuanceDate.toNumber() * 1000),
        expiryDate: new Date(credential.expiryDate.toNumber() * 1000),
        revoked: credential.revoked,
        details: credentialDetails
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/credentials/:address', authenticateToken, async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const credentialIds = await contract.getHolderCredentials(address);
    const credentials = [];

    for (const id of credentialIds) {
      const credential = await contract.getCredential(id);
      const details = await fetchFromIPFS(credential.ipfsHash);
      credentials.push({
        id,
        type: credential.credentialType,
        name: credential.credentialName,
        issuer: credential.issuer,
        issuanceDate: new Date(credential.issuanceDate.toNumber() * 1000),
        expiryDate: new Date(credential.expiryDate.toNumber() * 1000),
        revoked: credential.revoked,
        details
      });
    }

    res.json({ address, credentials });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'API is running', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Credential API running on port ${PORT}`);
});

module.exports = app;
