import React, { useEffect } from 'react';
import { Header, StatusMessage } from './containers';
import { Layout } from './containers/Layout';
import { AppProvider } from './providers';
import { AztecStorageService } from './services/aztec/core';
import { SecretPromptModal } from './components';

function App() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storageService = new AztecStorageService();
    const pendingClaims = storageService.getPendingClaims();
    const logKey = '[PENDING_CLAIMS]';

    if (pendingClaims.length === 0) {
      console.log(`${logKey} No pending claims found in storage at startup.`);
      return;
    }

    console.log(`${logKey} Pending claims loaded at startup:`, pendingClaims);
  }, []);

  return (
    <AppProvider>
      <SecretPromptModal />
      <div className="app">
        <Header />
        <StatusMessage />
        
        <main className="main-content">
          <Layout />
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
