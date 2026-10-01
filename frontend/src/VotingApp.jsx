import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import VotingSystemABI from './contracts/VotingSystem.json';

const VotingApp = () => {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [showEnded, setShowEnded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getPollStatus = (poll) => {
    const commitDL = Number(poll.commitDeadline);
    const revealDL = Number(poll.revealDeadline);

    if (now <= commitDL) {
      return {
        phase: 'Commit',
        timeLeft: commitDL - now,
        statusText: 'Commit phase',
        hint: 'Choose an option'
      };
    } else if (now <= revealDL) {
      return {
        phase: 'Reveal',
        timeLeft: revealDL - now,
        statusText: 'Reveal phase',
        hint: 'Confirm your choose'
      };
    } else {
      return {
        phase: 'Ended',
        timeLeft: 0,
        statusText: 'Poll is over',
        hint: 'Final results are ready'
      };
    }
  };

  // MetaMask connection
  const connectWallet = async () => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setAccount(address);

    const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
    const readOnlyContract = new ethers.Contract(
      contractAddress,
      VotingSystemABI.abi,
      provider
    );
    const writableContract = new ethers.Contract(
      contractAddress,
      VotingSystemABI.abi,
      signer
    );
    
    setContract(writableContract);
    loadPolls(readOnlyContract);
  } catch (error) {
    console.error('Error connecting wallet:', error);
  }
};

  // load polls
  const loadPolls = async (contractInstance) => {
    try {
      const count = await contractInstance.getPollCount();
      const pollsData = [];

      for (let i = 0; i < count; i++) {
        const poll = await contractInstance.getPoll(i);
        const results = await contractInstance.getResults(i);
        const phase = await contractInstance.getPollPhase(i);

        pollsData.push({
          id: i,
          title: poll.title,
          description: poll.description,
          options: poll.options,
          results: results.map(r => r.toString()),
          phase: phase,
          commitDeadline: poll.commitDeadline.toString(),
          revealDeadline: poll.revealDeadline.toString()
        });
      }

      setPolls(pollsData);
    } catch (error) {
      console.error('Error loading polls:', error);
    }
  };

  // create poll
  const createPoll = async (e) => {
    e.preventDefault();
    if (!contract) return;

    setLoading(true);
    try {
      const title = e.target.title.value;
      const description = e.target.description.value;
      const options = e.target.options.value.split(',').map(o => o.trim());
      
      // Считываем значения из полей формы (в секундах)
      const commitDuration = parseInt(e.target.commitDuration.value, 10);
      const revealDuration = parseInt(e.target.revealDuration.value, 10);

      const tx = await contract.createPoll(
        title,
        description,
        options,
        commitDuration,
        revealDuration
      );

      await tx.wait();
      await loadPolls(contract);
      e.target.reset();
    } catch (error) {
      console.error('Error creating poll:', error);
      const userFriendlyError = parseContractError(error);
      alert(`Error creating poll: ${userFriendlyError}`);
    }
    setLoading(false);
  };

  const parseContractError = (error) => {
    if (error.reason) {
      return error.reason;
    }
    if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
      return 'Transaction was rejected in MetaMask.';
    }
    if (error.shortMessage) {
      return error.shortMessage;
    }
    return 'An unexpected error occurred.';
  };

  // Commit vote
  const commitVote = async (pollId, optionIndex) => {
    if (!contract) return;

    setLoading(true);
    try {
      const salt = ethers.id(Math.random().toString());
      
      const hashedVote = ethers.solidityPackedKeccak256(
        ['uint256', 'bytes32'],
        [optionIndex, salt]
      );

      const votesData = JSON.parse(localStorage.getItem('userVotes') || '{}');
      votesData[`${pollId}-${account}`] = optionIndex; 
      localStorage.setItem('userVotes', JSON.stringify(votesData));

      const saltData = JSON.parse(localStorage.getItem('voteSalts') || '{}');
      saltData[`${pollId}-${account}`] = salt;
      localStorage.setItem('voteSalts', JSON.stringify(saltData));

      const tx = await contract.commit(pollId, hashedVote);
      await tx.wait();

      await loadPolls(contract);
      alert('Vote committed! You can reveal it after commit phase ends.');
    } catch (error) {
      console.error('Full error log for dev:', error);
      const userFriendlyError = parseContractError(error);
      alert(`Error: ${userFriendlyError}`);
    }
    setLoading(false);
  };

  // Reveal vote
  const revealVote = async (pollId) => { 
    if (!contract) return;

    setLoading(true);
    try {
      const saltData = JSON.parse(localStorage.getItem('voteSalts') || '{}');
      const salt = saltData[`${pollId}-${account}`];

      const votesData = JSON.parse(localStorage.getItem('userVotes') || '{}');
      const optionIndex = votesData[`${pollId}-${account}`]; 

      if (!salt || optionIndex === undefined) {
        alert('No saved vote for this poll');
        setLoading(false);
        return;
      }

      const tx = await contract.reveal(pollId, optionIndex, salt);
      await tx.wait();

      await loadPolls(contract);
      alert('Vote revealed!');
    } catch (error) {
      console.error('Error revealing vote:', error);
      const userFriendlyError = parseContractError(error);
      alert(`Error: ${userFriendlyError}`);
    }
    setLoading(false);
  };

  const renderPollCard = (poll) => {
    const status = getPollStatus(poll);

    return (
      <div key={poll.id} style={{ 
        border: '1px solid #ccc', 
        padding: '20px', 
        marginBottom: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        opacity: status.phase === 'Ended' ? 0.85 : 1 
      }}>
        <h3 style={{ marginTop: 0 }}>{poll.title} <small style={{ color: '#888', fontSize: '14px' }}>(#ID: {poll.id})</small></h3>
        <p>{poll.description}</p>
        
        <div style={{ 
          backgroundColor: status.phase === 'Commit' ? '#e3f2fd' : status.phase === 'Reveal' ? '#fff3e0' : '#f5f5f5',
          borderLeft: `5px solid ${status.phase === 'Commit' ? '#1976d2' : status.phase === 'Reveal' ? '#f57c00' : '#388e3c'}`,
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            📌 Status: {status.statusText}
          </p>
          {status.phase !== 'Ended' ? (
            <p style={{ margin: '5px 0 0 0', color: '#d32f2f', fontWeight: 'bold' }}>
              ⏳ Time remaining: {formatTime(status.timeLeft)}
            </p>
          ) : (
            <p style={{ margin: '5px 0 0 0', color: '#2e7d32', fontWeight: 'bold' }}>
              ✅ Final Results Locked
            </p>
          )}
          <small style={{ color: '#555', display: 'block', marginTop: '4px' }}>{status.hint}</small>
        </div>

        <div style={{ marginTop: '10px' }}>
          {poll.options.map((option, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #eee'
            }}>
              <span><strong>{option}</strong> — Votes: {poll.results[idx]}</span>
              
              {status.phase === 'Commit' && (
                <button
                  onClick={() => commitVote(poll.id, idx)}
                  disabled={loading}
                  style={{ padding: '6px 12px', cursor: 'pointer' }}
                >
                  Vote for this
                </button>
              )}
              
              {status.phase === 'Reveal' && (
                <button
                  onClick={() => revealVote(poll.id)}
                  disabled={loading}
                  style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#fff3e0', border: '1px solid #f57c00' }}
                >
                  Reveal vote
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const activePolls = polls.filter(poll => getPollStatus(poll).phase !== 'Ended');
  const endedPolls = polls.filter(poll => getPollStatus(poll).phase === 'Ended');

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🗳️ Decentralized Voting System</h1>

      {!account ? (
        <button onClick={connectWallet} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
          Connect MetaMask
        </button>
      ) : (
        <div>
          <p>Connected: <code>{account.substring(0, 6)}...{account.substring(38)}</code></p>

          <h2>Create New Poll</h2>
      <form onSubmit={createPoll} style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="text"
          name="title"
          placeholder="Poll title"
          required
          style={{ padding: '8px' }}
        />
        <input
          type="text"
          name="description"
          placeholder="Description"
          required
          style={{ padding: '8px' }}
        />
        <input
          type="text"
          name="options"
          placeholder="Options (comma separated, e.g. Yes, No, Maybe)"
          required
          style={{ padding: '8px' }}
        />

        {/* Поля ввода времени в секундах */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="number"
            name="commitDuration"
            placeholder="Commit Phase (seconds), e.g. 60"
            defaultValue={60}
            min={10}
            required
            style={{ padding: '8px', flex: 1 }}
          />
          <input
            type="number"
            name="revealDuration"
            placeholder="Reveal Phase (seconds), e.g. 60"
            defaultValue={60}
            min={10}
            required
            style={{ padding: '8px', flex: 1 }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ padding: '10px', cursor: 'pointer' }}>
          {loading ? 'Creating...' : 'Create Poll'}
        </button>
      </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Active Polls ({activePolls.length})</h2>
            
            {endedPolls.length > 0 && (
              <button 
                onClick={() => setShowEnded(!showEnded)}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: showEnded ? '#e0e0e0' : '#f0f0f0', 
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  cursor: 'pointer' 
                }}
              >
                {showEnded ? ' Hide Closed Polls' : ` Show History (${endedPolls.length})`}
              </button>
            )}
          </div>
          {activePolls.length === 0 ? (
            <p style={{ color: '#666' }}>No active polls right now.</p>
          ) : (
            activePolls.map(poll => renderPollCard(poll))
          )}

          {showEnded && (
            <div style={{ marginTop: '40px', borderTop: '2px dashed #ccc', paddingTop: '20px' }}>
              <h2 style={{ color: '#555' }}>🏁 Closed Polls History</h2>
              {endedPolls.map(poll => renderPollCard(poll))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VotingApp;