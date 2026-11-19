import { defineConfig, type Plugin } from 'vitest/config';
import { attachRelay } from './server/relay.mjs';

/** Liga o relay do co-op online ao servidor do Vite (dev e preview): o jogo e o WebSocket ficam na mesma porta. */
function coopRelay(): Plugin {
  return {
    name: 'coop-relay',
    configureServer(server) {
      if (server.httpServer) attachRelay(server.httpServer, { log: (m) => server.config.logger.info(`[coop] ${m}`) });
    },
    configurePreviewServer(server) {
      attachRelay(server.httpServer, { log: (m) => server.config.logger.info(`[coop] ${m}`) });
    },
  };
}

export default defineConfig({
  // base relativa: o build estático funciona em qualquer subpasta (GitHub Pages, Netlify etc.)
  base: './',
  plugins: [coopRelay()],
  server: { host: true }, // acessível na rede local: os amigos abrem http://<seu-ip>:5173
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
