// Servidor do co-op online: serve o build (dist/) e o relay WebSocket na mesma porta.
//   npm run build && npm run online        (porta 5174, ou PORT=...)
// Para jogar pela internet, exponha a porta (ngrok, cloudflared, port-forward) e mande o link aos amigos.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachRelay } from './relay.mjs';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT) || 5174;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(root, rel));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end('Proibido');
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404).end('Não encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(500).end('Erro');
  }
});

attachRelay(server, { log: (m) => console.log(`[coop] ${m}`) });

server.listen(port, '0.0.0.0', () => {
  console.log(`\nA Profecia de Sexta-Feira (co-op online) em http://localhost:${port}`);
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) console.log(`  na rede local:  http://${i.address}:${port}`);
  }
  console.log('');
});
