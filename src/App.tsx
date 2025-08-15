import React from 'react';
import { Header, StatusMessage } from './containers';
import { Layout } from './containers/Layout';
import { AztecWalletProvider, TokenProvider } from './providers';

function App() {
  return (
    <AztecWalletProvider>
      <TokenProvider>
        <div className="app">
          <Header />
          
          <main className="main-content">
            <Layout />
            <StatusMessage />
          </main>
        </div>
      </TokenProvider>
    </AztecWalletProvider>
  );
}

export default App;
