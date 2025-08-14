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
      return <div className="initializing">Waiting for app to initialize...</div>;
    }

    return (
      <div className="vote-display">
        <div className="vote-title">Current Vote Count</div>
        <div id="vote-results" className="vote-results">
          {isLoadingResults ? (
            <div>Loading vote results...</div>
          ) : (
            Object.entries(voteResults).map(([candidate, votes]) => (
              <div key={candidate}>
                Candidate {candidate}: {votes} votes
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      {renderVoteDisplay()}

      {isReady && (
        <form className="vote-form">
          <h4>Cast Vote</h4>
          <select 
            id="vote-input"
            value={selectedCandidate} 
            onChange={(e) => setSelectedCandidate(Number(e.target.value))}
            disabled={isVoting}
          >
            <option value="" disabled>Select a candidate (1-5)</option>
            <option value="1">Candidate 1</option>
            <option value="2">Candidate 2</option>
            <option value="3">Candidate 3</option>
            <option value="4">Candidate 4</option>
            <option value="5">Candidate 5</option>
          </select>
          <button 
            id="vote-button"
            type="button" 
            onClick={handleVote}
            disabled={!canVote}
          >
            {isVoting ? 'Voting...' : 'Vote'}
          </button>
        </form>
      )}
    </div>
  );
};
