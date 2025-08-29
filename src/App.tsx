import React from 'react';
import { Header, StatusMessage } from './containers';
import { Aztec95Interface } from './components/contract';
import { AppProvider } from './providers';

function App() {
  return (
    <AppProvider>
      <div className="app">
        <Header />
        <StatusMessage />
        
        <main className="main-content">
          <Aztec95Interface />
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
