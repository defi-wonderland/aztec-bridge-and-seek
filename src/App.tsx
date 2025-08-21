import React from 'react';
import { Header, StatusMessage } from './containers';
import { Layout } from './containers/Layout';
import { AztecWalletProvider, TokenProvider, ErrorProvider, EvmWalletProvider } from './providers';

function App() {
  return (
    <ErrorProvider>
      <EvmWalletProvider>
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
      </EvmWalletProvider>
    </ErrorProvider>
  );
}

export default App;
