import React from 'react';

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-title">Private Voting</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div id="account-display" className="account-display"></div>

          <select id="test-account-number" style={{ display: 'none' }}>
            <option value="1">Account 1</option>
            <option value="2">Account 2</option>
            <option value="3">Account 3</option>
          </select>
          <button id="connect-test-account" type="button" style={{ display: 'none' }}>
            Connect Test Account
          </button>
          <button id="create-account" type="button" style={{ display: 'none' }}>
            Create Account
          </button>
        </div>
      </nav>

      <main className="main-content">
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

        <div id="status-message" className="status-message"></div>
      </main>
    </div>
  );
}

export default App;
