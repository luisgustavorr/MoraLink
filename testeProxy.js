const http = require('http');
const httpProxy = require('http-proxy');

const TARGET = 'https://jsonplaceholder.typicode.com'; // exemplo de API pública

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  console.log('Requisitando:', TARGET + req.url);

  proxy.web(req, res, {
    target: TARGET,
    changeOrigin: true
  }, (e) => {
    console.error('Proxy error:', e.message);
    res.writeHead(502);
    res.end('Bad gateway');
  });
});

server.listen(8181, () => {
  console.log('Proxy rodando em http://localhost:8181');
});
