import React from 'react';
import { Header, VotingCard, StatusMessage } from './containers';
import { AztecWalletProvider } from './providers';

function App() {
  return (
    <AztecWalletProvider>
      <div className="app">
        <Header />
        
        <main className="main-content">
          <VotingCard />
          <StatusMessage />
        </main>
      </div>
    </AztecWalletProvider>
  );
}

export default App;
