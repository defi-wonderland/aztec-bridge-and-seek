import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Header } from './containers';
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
