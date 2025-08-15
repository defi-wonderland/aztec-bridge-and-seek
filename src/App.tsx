import React from 'react';
import { Header, VotingCard, StatusMessage, DripperCard, TokenBalanceCard } from './containers';
import { AztecWalletProvider, TokenProvider } from './providers';

function App() {
  return (
    <AztecWalletProvider>
      <TokenProvider>
        <div className="app">
          <Header />
          
          <main className="main-content">
            <DripperCard />
            <TokenBalanceCard />
            <VotingCard />
            <StatusMessage />
          </main>
        </div>
      </TokenProvider>
    </AztecWalletProvider>
  );
}

export default App;
