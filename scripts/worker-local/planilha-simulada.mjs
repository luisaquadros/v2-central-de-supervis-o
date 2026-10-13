// Planilha simulada (somente loopback) + JWKS. Guarda o estado em memória e imprime o que recebeu.
import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
const porta = Number(process.argv[2]), jwksArquivo = process.argv[3], estadoArquivo = process.argv[4];
const inicial = () => ({ orientacoes: [['orientacao_id','matricula_id','descricao','status','data_orientacao'], ['o1','m1','texto reservado','ABERTA','13/10/2026']] });
let abas = inicial();
const salvar = () => writeFileSync(estadoArquivo, JSON.stringify(abas));
salvar();
const ler = req => new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); });
const enviar = (res, d, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };
http.createServer(async (req, res) => {
  const u = decodeURIComponent(req.url), corpo = await ler(req);
  if (u.startsWith('/__reset')) { abas = inicial(); salvar(); return enviar(res, { ok: true }); }
  if (u.startsWith('/jwks')) return enviar(res, JSON.parse(readFileSync(jwksArquivo, 'utf8')));
  if (req.headers.authorization !== 'Bearer token-google-teste') return enviar(res, {}, 401);
  const aba = u.match(/values\/'([^'!]+)'/)?.[1];
  if (u.includes('fields=sheets')) return enviar(res, { sheets: Object.keys(abas).map(t => ({ properties: { title: t, sheetId: 1 } })) });
  if (req.method === 'POST' && u.includes('/values:batchUpdate')) {
    for (const p of JSON.parse(corpo).data) { const [, c, l] = p.range.match(/!([A-Z]+)(\d+)$/); abas[p.range.match(/^'([^']+)'/)[1]][Number(l) - 1][c.charCodeAt(0) - 65] = p.values[0][0]; }
    salvar(); return enviar(res, {});
  }
  if (req.method === 'POST' && u.endsWith(':batchUpdate')) { const a = JSON.parse(corpo).requests?.[0]?.addSheet; if (a) abas[a.properties.title] = []; salvar(); return enviar(res, {}); }
  if (req.method === 'PUT' && aba) { abas[aba][0] = JSON.parse(corpo).values[0]; salvar(); return enviar(res, {}); }
  if (req.method === 'POST' && u.includes(':append?') && aba) { abas[aba].push(JSON.parse(corpo).values[0]); salvar(); return enviar(res, {}); }
  if (aba) return enviar(res, { values: abas[aba] });
  enviar(res, { erro: 'rota ' + req.method + ' ' + u }, 404);
}).listen(porta, '127.0.0.1', () => console.log('mock pronto', porta));
