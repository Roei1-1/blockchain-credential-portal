// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title CredentialRegistry
 * @dev Manages issuance and verification of blockchain-based digital credentials
 */
contract CredentialRegistry {
    
    // Structs
    struct Credential {
        bytes32 credentialId;
        address issuer;
        address holder;
        string credentialType;
        string credentialName;
        string description;
        uint256 issuanceDate;
        uint256 expiryDate;
        string ipfsHash;
        bool revoked;
    }

    struct CredentialHolder {
        address holderAddress;
        string name;
        string email;
        string profileIpfsHash;
        uint256 memberSince;
        uint256 credentialCount;
    }

    // State Variables
    mapping(bytes32 => Credential) public credentials;
    mapping(address => CredentialHolder) public holders;
    mapping(address => bytes32[]) public holderCredentials;
    mapping(address => bool) public authorizedIssuers;
    
    address public admin;
    uint256 public credentialCount;

    // Events
    event CredentialIssued(
        bytes32 indexed credentialId,
        address indexed issuer,
        address indexed holder,
        string credentialType,
        uint256 issuanceDate
    );
    
    event CredentialRevoked(bytes32 indexed credentialId, address indexed revokedBy);
    event HolderRegistered(address indexed holder, string name);
    event IssuerAuthorized(address indexed issuer);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "Not an authorized issuer");
        _;
    }

    // Constructor
    constructor() {
        admin = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    // Admin Functions
    function authorizeIssuer(address issuer) external onlyAdmin {
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    function revokeIssuerAuthorization(address issuer) external onlyAdmin {
        authorizedIssuers[issuer] = false;
    }

    // Holder Functions
    function registerHolder(
        string memory _name,
        string memory _email,
        string memory _profileIpfsHash
    ) external {
        require(bytes(_name).length > 0, "Name cannot be empty");
        
        holders[msg.sender] = CredentialHolder({
            holderAddress: msg.sender,
            name: _name,
            email: _email,
            profileIpfsHash: _profileIpfsHash,
            memberSince: block.timestamp,
            credentialCount: 0
        });
        
        emit HolderRegistered(msg.sender, _name);
    }

    // Issue Credential
    function issueCredential(
        address _holder,
        string memory _credentialType,
        string memory _credentialName,
        string memory _description,
        uint256 _expiryDate,
        string memory _ipfsHash
    ) external onlyAuthorizedIssuer returns (bytes32) {
        
        require(_holder != address(0), "Invalid holder address");
        require(bytes(_credentialName).length > 0, "Credential name required");
        require(_expiryDate > block.timestamp, "Expiry date must be in future");

        bytes32 credentialId = keccak256(
            abi.encodePacked(_holder, msg.sender, block.timestamp, credentialCount)
        );

        credentials[credentialId] = Credential({
            credentialId: credentialId,
            issuer: msg.sender,
            holder: _holder,
            credentialType: _credentialType,
            credentialName: _credentialName,
            description: _description,
            issuanceDate: block.timestamp,
            expiryDate: _expiryDate,
            ipfsHash: _ipfsHash,
            revoked: false
        });

        holderCredentials[_holder].push(credentialId);
        holders[_holder].credentialCount++;
        credentialCount++;

        emit CredentialIssued(
            credentialId,
            msg.sender,
            _holder,
            _credentialType,
            block.timestamp
        );

        return credentialId;
    }

    // Verify Credential
    function verifyCredential(bytes32 _credentialId) 
        external 
        view 
        returns (bool isValid, string memory reason) 
    {
        Credential memory credential = credentials[_credentialId];
        
        if (credential.credentialId == bytes32(0)) {
            return (false, "Credential not found");
        }
        
        if (credential.revoked) {
            return (false, "Credential has been revoked");
        }
        
        if (block.timestamp > credential.expiryDate) {
            return (false, "Credential has expired");
        }
        
        return (true, "Credential is valid");
    }

    // Get Credential
    function getCredential(bytes32 _credentialId) 
        external 
        view 
        returns (Credential memory) 
    {
        return credentials[_credentialId];
    }

    // Get Holder Credentials
    function getHolderCredentials(address _holder) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return holderCredentials[_holder];
    }

    // Get Holder Profile
    function getHolderProfile(address _holder) 
        external 
        view 
        returns (CredentialHolder memory) 
    {
        return holders[_holder];
    }

    // Revoke Credential
    function revokeCredential(bytes32 _credentialId) 
        external 
    {
        Credential storage credential = credentials[_credentialId];
        require(credential.credentialId != bytes32(0), "Credential not found");
        require(
            msg.sender == credential.issuer || msg.sender == admin,
            "Only issuer or admin can revoke"
        );
        
        credential.revoked = true;
        emit CredentialRevoked(_credentialId, msg.sender);
    }
}
