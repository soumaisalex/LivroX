import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div style="max-width:760px;margin:1rem auto;padding:1rem;border:1px solid #f0c7c7;background:#fff2f2;border-radius:10px;font-family:system-ui;">
      <h1>Erro de inicialização</h1>
      <p>O app falhou ao iniciar. Detalhes:</p>
      <pre style="white-space:pre-wrap;">${error?.message || error}</pre>
    </div>
  `;
}
