import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Run the vanilla JS logic after React renders
setTimeout(async () => {
  try {
    const { initializeVanillaJS } = await import('./main-vanilla');
    initializeVanillaJS();
    console.log('Vanilla JS logic loaded after React render');
  } catch (error) {
    console.error('Failed to load vanilla JS logic:', error);
  }
}, 100);
