import React from 'react';

export const VotingCard: React.FC = () => {
  return (
    <div className="card">
      <div className="vote-display">
        <div className="vote-title">Current Vote Count</div>
        <div id="vote-results" className="vote-results"></div>
      </div>

      <form className="vote-form" style={{ display: 'none' }}>
        <h4>Cast Vote</h4>
        <select id="vote-input">
          <option value="" disabled>Select a candidate (1-5)</option>
          <option value="1">Candidate 1</option>
          <option value="2">Candidate 2</option>
          <option value="3">Candidate 3</option>
          <option value="4">Candidate 4</option>
          <option value="5">Candidate 5</option>
        </select>
        <button id="vote-button" type="button">Vote</button>
      </form>
    </div>
  );
};
