import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(process.env.STATIC_DIR || 'dist');
const base = process.env.BASE_PATH || '/';
const headers = process.env.HOST_HEADERS !== 'meta';
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (base !== '/' && url.pathname === base.slice(0, -1)) {
      res.writeHead(308, { Location: base + url.search }).end();
      return;
    }
    if (!url.pathname.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    const pathname = '/' + url.pathname.slice(base.length);
    const file = resolve(root, `.${decodeURIComponent(pathname)}`);
    if (file !== root && !file.startsWith(root + '/')) {
      res.writeHead(403).end();
      return;
    }
    let path = file;
    try {
      if (!(await stat(path)).isFile()) path = resolve(root, 'index.html');
    } catch {
      if (extname(path)) {
        res.writeHead(404).end();
        return;
      }
      path = resolve(root, 'index.html');
    }
    res.setHeader(
      'Content-Type',
      types[extname(path)] || 'application/octet-stream',
    );
    res.setHeader('Cache-Control', 'no-cache');
    if (headers)
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), microphone=(self), geolocation=()',
    );
    if (headers) res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (headers) res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.end(await readFile(path));
  } catch {
    res.writeHead(500).end();
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`inkstory preview on http://127.0.0.1:${port}`),
);
