import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { criarEmissor } from '../../src/tests/ajudaAutorizacao';
const [, , portaW, jwksArq, estadoArq] = process.argv;
const T = Date.now().toString(36);
const em = await criarEmissor('k' + Date.now());
writeFileSync(jwksArq, JSON.stringify(em.jwks));
await fetch('http://127.0.0.1:' + (process.env.PORTA_MOCK || 8799) + '/__reset');
const base = `http://127.0.0.1:${portaW}`;
const estado = () => JSON.parse(readFileSync(estadoArq, 'utf8'));
const idAdmin = await em.token('professora@exemplo.com'), idAluna = await em.token('aluna@exemplo.com');
const enviar = (id: string | null, op: string, status: string, esperado: any, extra: Record<string, unknown> = {}) => fetch(base + '/api/critical-write', {
  method: 'POST', headers: { Authorization: 'Bearer token-google-teste', 'Content-Type': 'application/json', ...(id ? { 'X-Firebase-Id-Token': id } : {}) },
  body: JSON.stringify({ tabela: 'orientacoes', tipo: 'UPDATE', operacaoId: op, usuario: 'falso@x.com', esperado, registro: { orientacao_id: 'o1', status, descricao: 'texto reservado novo' }, ...extra }),
});
const v0 = { orientacao_id: 'o1', matricula_id: 'm1', descricao: 'texto reservado', status: 'ABERTA', data_orientacao: '2026-10-13' };
const resultado: Record<string, unknown> = {};
let r = await enviar(null, 'real-' + T + '-0001', 'CONCLUIDA', v0); resultado['sem identidade'] = r.status; assert.equal(r.status, 401);
r = await enviar(idAluna, 'real-' + T + '-0002', 'CONCLUIDA', v0); resultado['conta fora da lista'] = r.status; assert.equal(r.status, 403);
assert.equal(estado().orientacoes[1][3], 'ABERTA', 'recusadas não gravam');
r = await enviar(idAdmin, 'real-' + T + '-0003', 'CONCLUIDA', v0); const j1 = await r.json(); resultado['administradora (UPDATE)'] = `${r.status} auditoria=${j1.auditoria}`; assert.equal(r.status, 200);
assert.equal(estado().orientacoes[1][3], 'CONCLUIDA'); assert.equal(estado().orientacoes[1][4], '13/10/2026', 'coluna não editada preservada');
const log = estado().log_alteracoes; assert.equal(log.length, 2);
resultado['linha do log'] = { usuario: log[1][2], tabela: log[1][3], id: log[1][4], acao: log[1][5], campos: log[1][6], antes: log[1][7], depois: log[1][8] };
assert.equal(log[1][2], 'professora@exemplo.com'); assert(!JSON.stringify(log).includes('texto reservado'), 'texto livre fora do log');
r = await enviar(idAdmin, 'real-' + T + '-0003', 'CONCLUIDA', v0); const j2 = await r.json(); resultado['reenvio idêntico'] = `${r.status} replayed=${j2.replayed}`; assert.equal(j2.replayed, true); assert.equal(estado().log_alteracoes.length, 2);
r = await enviar(idAdmin, 'real-' + T + '-0004', 'CANCELADA', v0); resultado['versão antiga'] = r.status; assert.equal(r.status, 409); assert.equal(estado().orientacoes[1][3], 'CONCLUIDA');
const atual = { ...v0, status: 'CONCLUIDA', descricao: 'texto reservado novo' };
const par = await Promise.all([enviar(idAdmin, 'real-' + T + '-0005', 'REVISAR', atual), enviar(idAdmin, 'real-' + T + '-0006', 'ARQUIVADA', atual)]);
resultado['duas gravações simultâneas'] = par.map(x => x.status).sort(); assert.deepEqual(par.map(x => x.status).sort(), [200, 409]);
const ac = await fetch(base + '/api/acesso', { headers: { 'X-Firebase-Id-Token': idAdmin } }); resultado['/api/acesso'] = `${ac.status} ${JSON.stringify(await ac.json())}`;
r = await fetch(base + '/api/critical-write', { method: 'POST', headers: { 'X-Firebase-Id-Token': idAdmin}, body: 'x'.repeat(200000) }); resultado['corpo > 128 KB'] = r.status; assert.equal(r.status, 413);
const idx = await fetch(base + '/'); resultado['arquivos estáticos'] = idx.status; assert.equal(idx.status, 200);
console.log(JSON.stringify(resultado, null, 2));
console.log('WORKER REAL: todos os cenários passaram');
