import React, { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Header } from './containers';
import { Layout } from './containers/Layout';
import { AppProvider } from './providers';
import { AztecStorageService } from './services/aztec/core';

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
      <div className="app">
        <Header />
        
        <main className="main-content">
          <Layout />
        </main>

        {/* Toast notifications */}
        <ToastContainer
          position="bottom-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </div>
    </AppProvider>
  );
}

export default App;
