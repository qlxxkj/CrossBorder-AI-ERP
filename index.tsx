
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("FATAL: Could not find root element to mount to");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("AMZBot Application initialized successfully.");
  } catch (error) {
    console.error("AMZBot Boot Error:", error);
    rootElement.innerHTML = `
      <div style="padding: 40px; font-family: sans-serif; text-align: center;">
        <h1 style="color: #ef4444;">Application Crash</h1>
        <p>A runtime error occurred during initialization.</p>
        <pre style="background: #f1f5f9; padding: 20px; border-radius: 10px; display: inline-block; text-align: left; max-width: 80%; overflow: auto;">
          ${error instanceof Error ? error.message : String(error)}
        </pre>
      </div>
    `;
  }
}
