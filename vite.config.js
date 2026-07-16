import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages (projeto): /nome-do-repositorio/
// Deploy local/estático: caminhos relativos ./
function resolveBase() {
  if (process.env.VITE_BASE) return process.env.VITE_BASE;

  if (process.env.GITHUB_PAGES === 'true' && process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1];
    return `/${repo}/`;
  }

  return './';
}

export default defineConfig({
  plugins: [react()],
  base: resolveBase(),
  define: {
    // Carimbo de build usado para invalidar cache do navegador a cada deploy.
    __APP_BUILD__: JSON.stringify(String(Date.now()))
  }
});
