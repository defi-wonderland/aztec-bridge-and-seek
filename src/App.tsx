import React from 'react';
import { Header, StatusMessage } from './containers';
import { Layout } from './containers/Layout';
import { AztecWalletProvider, TokenProvider, ErrorProvider } from './providers';

function App() {
  return (
    <ErrorProvider>
      <AztecWalletProvider>
        <TokenProvider>
          <div className="app">
            <Header />
            <StatusMessage />
            
            <main className="main-content">
              <Layout />
            </main>
          </div>
        </TokenProvider>
      </AztecWalletProvider>
    </ErrorProvider>
  );
}

export default App;
