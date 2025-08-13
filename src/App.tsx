import React from 'react';
import { Header, VotingCard, StatusMessage } from './containers';

function App() {
  return (
    <div className="app">
      <Header />
      
      <main className="main-content">
        <VotingCard />
        <StatusMessage />
      </main>
    </div>
  );
}

export default App;
