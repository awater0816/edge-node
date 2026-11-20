// VLESS over WebSocket —— 可在免费容器平台（Render / Koyeb）上跑的单文件节点
// 协议：VLESS TCP（cmd=1）隧道；客户端 xray 用 vless + ws + tls
const http = require('http');
const net = require('net');
const { WebSocketServer } = require('ws');

const UUID = String(process.env.UUID || '2195b526-cff8-49ce-9aa2-cd5bed1a97e6')
  .toLowerCase().replace(/-/g, '');
const PORT = Number(process.env.PORT || 10000);
const WS_PATH = process.env.WS_PATH || '/';
const MAX_HEADER = 1024;

function parseVless(buf) {
  if (buf.length < 18) return null;               // 头还没收完
  const ver = buf[0];
  const id = buf.subarray(1, 17).toString('hex');
  if (id !== UUID) return { ok: false, why: 'uuid mismatch' };
  let i = 17;
  const optLen = buf[i]; i += 1;
  if (buf.length < i + optLen + 1 + 2 + 1) return null;
  i += optLen;
  const cmd = buf[i]; i += 1;
  const port = buf.readUInt16BE(i); i += 2;
  const atype = buf[i]; i += 1;
  let host;
  if (atype === 1) {
    if (buf.length < i + 4) return null;
    host = Array.from(buf.subarray(i, i + 4)).join('.');
    i += 4;
  } else if (atype === 2) {
    if (buf.length < i + 1) return null;
    const l = buf[i]; i += 1;
    if (buf.length < i + l) return null;
    host = buf.subarray(i, i + l).toString('utf8');
    i += l;
  } else if (atype === 3) {
    if (buf.length < i + 16) return null;
    const parts = [];
    for (let k = 0; k < 8; k++) parts.push(buf.readUInt16BE(i + k * 2).toString(16));
    host = parts.join(':');
    i += 16;
  } else {
    return { ok: false, why: 'bad atyp ' + atype };
  }
  if (cmd !== 1) return { ok: false, why: 'cmd ' + cmd + ' (only TCP supported)' };
  return { ok: true, ver, host, port, rest: buf.subarray(i) };
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('edge-node up\n');
});

const wss = new WebSocketServer({
  server,
  path: WS_PATH,
  perMessageDeflate: false,
  maxPayload: 64 * 1024 * 1024,
  clientTracking: true,
});

wss.on('connection', (ws) => {
  let pending = Buffer.alloc(0);
  let header = null;
  let remote = null;

  const kill = () => {
    try { if (remote) remote.destroy(); } catch (e) {}
    try { if (ws.readyState === ws.OPEN) ws.close(); } catch (e) {}
  };

  ws.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!header) {
      pending = Buffer.concat([pending, buf]);
      if (pending.length > MAX_HEADER && !header) { kill(); return; }
      const parsed = parseVless(pending);
      if (!parsed) return;                       // 继续等
      if (!parsed.ok) { kill(); return; }
      header = parsed;
      const rest = parsed.rest;
      pending = null;

      remote = net.connect({ host: header.host, port: header.port });
      remote.setNoDelay(true);
      remote.on('connect', () => {
        // VLESS 响应头：version + addonLen(0)
        try { ws.send(Buffer.from([header.ver, 0])); } catch (e) {}
        if (rest && rest.length) remote.write(rest);
      });
      remote.on('data', (d) => { if (ws.readyState === ws.OPEN) ws.send(d); });
      remote.on('close', kill);
      remote.on('error', kill);
    } else if (remote) {
      remote.write(buf);
    }
  });

  ws.on('close', kill);
  ws.on('error', kill);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`edge-node listening on :${PORT} path=${WS_PATH} uuid=${UUID.slice(0, 8)}…`);
});
