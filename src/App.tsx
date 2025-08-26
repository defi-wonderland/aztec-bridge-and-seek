import React from 'react';
import { Header, NotificationStack } from './containers';
import { Layout } from './containers/Layout';
import { AppProvider } from './providers';

function App() {
  return (
    <AppProvider>
      <div className="app">
        <Header />
        
        <main className="main-content">
          <Layout />
        </main>
        
        <NotificationStack />
      </div>
    </AppProvider>
  );
}

export default App;
