import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import axios from 'axios';
import './CredentialPortal.css';

const CredentialPortal = () => {
  const [account, setAccount] = useState(null);
  const [connected, setConnected] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [web3, setWeb3] = useState(null);

  useEffect(() => {
    const initWeb3 = async () => {
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);
      }
    };
    initWeb3();
  }, []);

  const connectWallet = async () => {
    try {
      setLoading(true);
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      setAccount(accounts[0]);
      setConnected(true);
      await loadUserData(accounts[0]);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (address) => {
    try {
      const response = await axios.get(`/api/holders/${address}`);
      setProfile(response.data.holder);
      
      const credResponse = await axios.get(`/api/credentials/${address}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCredentials(credResponse.data.credentials);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const verifyCredential = async (credentialId) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/credentials/${credentialId}/verify`);
      alert(`Credential Status: ${response.data.reason}`);
    } catch (error) {
      console.error('Error verifying credential:', error);
      alert('Failed to verify credential');
    } finally {
      setLoading(false);
    }
  };

  const renderCareerTimeline = () => {
    return (
      <div className="timeline">
        {credentials.length === 0 ? (
          <p>No credentials yet</p>
        ) : (
          credentials.map((cred, index) => (
            <div key={index} className="timeline-item">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <h3>{cred.name}</h3>
                <p className="credential-type">{cred.type}</p>
                <p className="credential-issuer">Issuer: {cred.issuer}</p>
                <p className="credential-date">
                  {new Date(cred.issuanceDate).toLocaleDateString()}
                </p>
                <div className="credential-actions">
                  <button onClick={() => verifyCredential(cred.id)}>
                    Verify
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  if (!connected) {
    return (
      <div className="portal-container">
        <div className="welcome-section">
          <h1>🎓 Blockchain Credential Portal</h1>
          <p>Manage and verify your digital credentials on the blockchain</p>
          <button 
            onClick={connectWallet} 
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-container">
      <header className="portal-header">
        <h1>Digital Credential Portal</h1>
        <div className="account-info">
          <p>Connected: {account?.slice(0, 6)}...{account?.slice(-4)}</p>
        </div>
      </header>

      <nav className="portal-nav">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={activeTab === 'career' ? 'active' : ''}
          onClick={() => setActiveTab('career')}
        >
          Career Timeline
        </button>
      </nav>

      <main className="portal-content">
        {activeTab === 'dashboard' && profile && (
          <section className="dashboard">
            <h2>Dashboard</h2>
            <div className="profile-summary">
              <p><strong>Name:</strong> {profile.name}</p>
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Credentials:</strong> {profile.credentialCount}</p>
              <p><strong>Member Since:</strong> 
                 {new Date(profile.memberSince * 1000).toLocaleDateString()}
              </p>
            </div>
          </section>
        )}

        {activeTab === 'career' && (
          <section className="career-timeline">
            <h2>Career Timeline</h2>
            {renderCareerTimeline()}
          </section>
        )}
      </main>
    </div>
  );
};

export default CredentialPortal;
