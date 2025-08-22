import React from 'react';
import { useVoting } from '../hooks/useVoting';

export const VotingCard: React.FC = () => {
  const {
    selectedCandidate,
    voteResults,
    isVoting,
    isLoadingResults,
    isReady,
    canVote,
    setSelectedCandidate,
    handleVote,
  } = useVoting();

  const renderVoteDisplay = () => {
    if (!isReady) {
      return (
        <div className="initializing">Waiting for app to initialize...</div>
      );
    }

    return (
      <div className="vote-display">
        <div className="vote-title">Current Vote Count</div>
        <div id="vote-results" className="vote-results">
          {isLoadingResults ? (
            <div>Loading vote results...</div>
          ) : (
            Object.entries(voteResults).map(([candidate, votes]) => (
              <div key={candidate} className="vote-result">
                Candidate {candidate}:{' '}
                <span className="vote-count">{votes} votes</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="voting-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">🗳️</span>
        </div>
        <div>
          <h3>Private Voting</h3>
          <p>Cast your vote privately using zero-knowledge proofs</p>
        </div>
      </div>

      {renderVoteDisplay()}

      {isReady && (
        <div className="vote-form-container">
          <div className="form-section">
            <h4>Cast Vote</h4>
            <div className="form-group">
              <label htmlFor="vote-input">Select Candidate</label>
              <select
                id="vote-input"
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(Number(e.target.value))}
                disabled={isVoting}
                className="form-select"
              >
                <option value="" disabled>
                  Select a candidate (1-5)
                </option>
                <option value="1">Candidate 1</option>
                <option value="2">Candidate 2</option>
                <option value="3">Candidate 3</option>
                <option value="4">Candidate 4</option>
                <option value="5">Candidate 5</option>
              </select>
            </div>
            <button
              id="vote-button"
              type="button"
              onClick={handleVote}
              disabled={!canVote}
              className="btn btn-primary"
            >
              <span className="btn-icon">🗳️</span>
              {isVoting ? 'Voting...' : 'Vote'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
