const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const STATIC_DIR = path.join(__dirname, '.next', 'static');
const SERVER_DIR = path.join(__dirname, '.next', 'server');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.rsc': 'text/x-component',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath);
  return MIME_TYPES[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  
  // Handle _next/static requests
  if (urlPath.startsWith('/_next/static/')) {
    const filePath = path.join(__dirname, '.next', urlPath.slice(1));
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
      res.end(content);
      return;
    }
  }
  
  // Handle the root page
  if (urlPath === '/' || urlPath === '') {
    const htmlPath = path.join(SERVER_DIR, 'app', 'index.html');
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
  }
  
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Custom server running on port ${PORT}`);
});
