import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // O site lê só as variáveis que começam com VITE_ (as públicas). A chave secreta nunca vai para o site.
  envPrefix: 'VITE_',
});
