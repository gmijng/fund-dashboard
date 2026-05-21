#!/usr/bin/env node
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

// Load seed data
const seedFunds = JSON.parse(fs.readFileSync(path.join(__dirname, 'funds_seed.json'), 'utf8'));
const seedMarketData = {};
for (const f of seedFunds) {
  seedMarketData[f.code] = {
    name: f.name,
    gsz: f.gsz,
    gszzl: f.gszzl,
    dwjz: f.dwjz,
    gztime: f.gztime
  };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Proxy fundgz
function proxyFundGJ(code, res) {
  const options = {
    hostname: 'fundgz.1234567.com.cn',
    path: `/js/${code}.js`,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  };
  const req = https.get(options, (apiRes) => {
    let data = '';
    apiRes.on('data', c => data += c);
    apiRes.on('end', () => {
      setCors(res);
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(data);
    });
  });
  req.on('error', () => { res.writeHead(502); res.end('Proxy error'); });
  req.setTimeout(8000, () => { req.destroy(); res.writeHead(504); res.end('Timeout'); });
}

// Proxy Sina index
function proxyIndex(codes, res) {
  const options = {
    hostname: 'hq.sinajs.cn',
    path: '/list=' + codes,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn' }
  };
  const req = https.get(options, (apiRes) => {
    let data = '';
    apiRes.on('data', c => data += c);
    apiRes.on('end', () => {
      setCors(res);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      const buf = Buffer.from(data, 'binary');
      res.end(buf.toString('utf8'));
    });
  });
  req.on('error', () => { res.writeHead(502); res.end('Proxy error'); });
  req.setTimeout(8000, () => { req.destroy(); res.writeHead(504); res.end('Timeout'); });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // Seed init: send pre-loaded fund data for initial population
  if (parsed.pathname === '/api/seed') {
    setCors(res);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ funds: seedFunds, marketData: seedMarketData }));
    return;
  }

  // Proxy: /proxy/fund/CODE
  if (parsed.pathname.startsWith('/proxy/fund/')) {
    const code = parsed.pathname.replace('/proxy/fund/', '').replace(/[^0-9]/g, '');
    if (!code) { res.writeHead(400); res.end('Invalid code'); return; }
    proxyFundGJ(code, res);
    return;
  }

  // Proxy: /proxy/index?codes=sh000001,...
  if (parsed.pathname === '/proxy/index') {
    const codes = parsed.query.codes || '';
    proxyIndex(codes, res);
    return;
  }

  // Static files
  if (parsed.pathname === '/' || parsed.pathname === '/index.html') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (parsed.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`基金看盘面板: http://localhost:${PORT}`);
});