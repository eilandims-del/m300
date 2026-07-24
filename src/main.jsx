import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { runVersionGuard } from './utils/cacheGuard.js';
import './styles.css';

// Limpa cache antigo do navegador quando o site foi atualizado (novo build).
runVersionGuard();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
