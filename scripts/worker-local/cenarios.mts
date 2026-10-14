import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { criarEmissor } from '../../src/tests/ajudaAutorizacao';
const [, , portaW, jwksArq, estadoArq] = process.argv;
const PM = process.env.PORTA_MOCK || '8799';
const T = Date.now().toString(36);
const em = await criarEmissor('k' + T);
writeFileSync(jwksArq, JSON.stringify(em.jwks));
await fetch(`http://127.0.0.1:${PM}/__reset`);
const base = `http://127.0.0.1:${portaW}`;
const estado = () => JSON.parse(readFileSync(estadoArq, 'utf8'));
const idAdmin = await em.token('professora@exemplo.com'), idAluna = await em.token('aluna@exemplo.com'), idMon = await em.token('monitora@exemplo.com');
const hdr = (id: string | null) => ({ Authorization: 'Bearer token-google-teste', 'Content-Type': 'application/json', ...(id ? { 'X-Firebase-Id-Token': id } : {}) });
const escrever = (id: string | null, op: string, tabela: string, tipo: string, registro: any, esperado: any = null) => fetch(base + '/api/critical-write', {
  method: 'POST', headers: hdr(id), body: JSON.stringify({ tabela, tipo, operacaoId: `real-${T}-${op}`, usuario: 'falso@x.com', esperado, registro }) });
const get = async (id: string | null, caminho: string, metodo = 'GET') => { const r = await fetch(base + caminho, { method: metodo, headers: hdr(id) }); return { status: r.status, corpo: await r.json() as any }; };
const resultado: Record<string, unknown> = {};

// ---------- administradora: escrita versionada + log ----------
const v0 = { orientacao_id: 'o1', matricula_id: 'm1', descricao: 'texto reservado', status: 'ABERTA', data_orientacao: '2026-10-13' };
let r = await escrever(null, '0001', 'orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'CONCLUIDA' }, v0); resultado['sem identidade'] = r.status; assert.equal(r.status, 401);
r = await escrever(idAluna, '0002', 'orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'CONCLUIDA' }, v0); resultado['conta sem papel (aluna)'] = r.status; assert.equal(r.status, 403);
assert.equal(estado().orientacoes[1][3], 'ABERTA', 'recusadas não gravam');
r = await escrever(idAdmin, '0003', 'orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'CONCLUIDA', descricao: 'texto reservado novo' }, v0); const j1 = await r.json(); resultado['administradora (UPDATE)'] = `${r.status} auditoria=${j1.auditoria}`; assert.equal(r.status, 200);
assert.equal(estado().orientacoes[1][3], 'CONCLUIDA'); assert.equal(estado().orientacoes[1][4], '13/10/2026', 'coluna não editada preservada');
const log = estado().log_alteracoes; assert.equal(log.length, 2);
resultado['linha do log'] = { usuario: log[1][2], tabela: log[1][3], id: log[1][4], acao: log[1][5], campos: log[1][6], antes: log[1][7], depois: log[1][8] };
assert.equal(log[1][2], 'professora@exemplo.com'); assert(!JSON.stringify(log).includes('texto reservado'), 'texto livre fora do log');
r = await escrever(idAdmin, '0003', 'orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'CONCLUIDA' }, v0); const j2 = await r.json(); resultado['reenvio idêntico'] = `${r.status} replayed=${j2.replayed}`; assert.equal(j2.replayed, true); assert.equal(estado().log_alteracoes.length, 2);
r = await escrever(idAdmin, '0004', 'orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'CANCELADA' }, v0); resultado['versão antiga'] = r.status; assert.equal(r.status, 409); assert.equal(estado().orientacoes[1][3], 'CONCLUIDA');
const atual = { ...v0, status: 'CONCLUIDA', descricao: 'texto reservado novo' };
const par = await Promise.all([escrever(idAdmin, '0005', 'orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'REVISAR', descricao: 'texto reservado novo' }, atual), escrever(idAdmin, '0006', 'orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'ARQUIVADA', descricao: 'texto reservado novo' }, atual)]);
resultado['duas gravações simultâneas'] = par.map(x => x.status).sort(); assert.deepEqual(par.map(x => x.status).sort(), [200, 409]);

// ---------- monitora: conta de serviço + turma + tabelas ----------
const usosAntes = estado().__usos.length;
const f1 = { frequencia_id: 'f1', matricula_id: 'mA', data_aula: '2026-10-13', status: 'PRESENTE' };
r = await escrever(idMon, '0101', 'frequencias', 'UPDATE', { ...f1, status: 'FALTA_SEM_JUSTIFICATIVA' }, f1); resultado['monitora grava chamada da própria turma'] = r.status; if (r.status !== 200) console.log('DEBUG', await r.text()); assert.equal(r.status, 200);
const usados = estado().__usos.slice(usosAntes); assert(usados.length > 0 && usados.every((a: string) => a === 'token-conta-servico'), 'o Sheets só viu a conta de serviço: ' + usados.join(','));
resultado['credencial vista pela planilha (monitora)'] = [...new Set(usados)];
assert.equal(estado().frequencias[1][3], 'FALTA_SEM_JUSTIFICATIVA'); assert.equal(estado().log_alteracoes.at(-1)[2], 'monitora@exemplo.com');
const f2 = { frequencia_id: 'f2', matricula_id: 'mC', data_aula: '2026-10-13', status: 'PRESENTE' };
r = await escrever(idMon, '0102', 'frequencias', 'UPDATE', { ...f2, status: 'FALTA_SEM_JUSTIFICATIVA' }, f2); resultado['monitora, matrícula de outra turma'] = `${r.status} ${(await r.json()).code}`; assert.equal(r.status, 403); assert.equal(estado().frequencias[2][3], 'PRESENTE');
r = await escrever(idMon, '0103', 'avaliacoes', 'UPDATE', { avaliacao_id: 'v1', nota: 10 }, { avaliacao_id: 'v1', nota: 8 }); resultado['monitora grava nota'] = r.status; assert.equal(r.status, 403); assert.equal(estado().avaliacoes[1][2], 8, 'nota intacta');
r = await escrever(idMon, '0104', 'frequencias', 'DELETE', f1, { ...f1, status: 'FALTA_SEM_JUSTIFICATIVA' }); assert.equal(r.status, 403);
let l = await get(idMon, '/api/leitura?tabelas=avaliacoes'); resultado['monitora lê avaliações'] = `${l.status} ${l.corpo.code}`; assert.equal(l.status, 403);
l = await get(idMon, '/api/leitura?tabelas=turmas,matriculas,alunos,frequencias,monitoramento_documentos');
assert.equal(l.status, 200);
assert.deepEqual(l.corpo.tabelas.turmas.values.slice(1).map((x: any[]) => x[0]), ['t2b']); assert.deepEqual(l.corpo.tabelas.matriculas.values.slice(1).map((x: any[]) => x[0]), ['mA']);
const txt = JSON.stringify(l.corpo); assert(!txt.includes('e1@exemplo.com') && !txt.includes('atestado') && !txt.includes('observação minha'), 'e-mail, justificativa e observação manual não saem');
resultado['monitora lê (filtrado)'] = { turmas: l.corpo.tabelas.turmas.values.length - 1, matriculas: l.corpo.tabelas.matriculas.values.length - 1, documentos: l.corpo.tabelas.monitoramento_documentos.values.length - 1 };
assert.deepEqual(l.corpo.tabelas.monitoramento_documentos.values.slice(1).map((x: any[]) => x[0]), ['m1'], 'só o documento da turma 2B');
const sm = await get(idMon, '/api/documentos/sincronizar', 'POST'); resultado['monitora sincroniza'] = sm.status; assert.equal(sm.status, 403);

// ---------- sincronização de metadados do Drive (manual) ----------
const idx = (n: string) => estado().monitoramento_documentos[0].indexOf(n);
const s1 = await get(idAdmin, '/api/documentos/sincronizar', 'POST'); assert.equal(s1.status, 200, JSON.stringify(s1.corpo));
resultado['sincronização manual'] = { status: s1.corpo.resultado.status, lidos: s1.corpo.resultado.lidos, atualizados: s1.corpo.resultado.atualizados, erros: s1.corpo.resultado.erros };
const mon = estado().monitoramento_documentos;
assert.equal(mon.length, 5, 'nenhuma linha criada'); assert.equal(mon[1][idx('status')], 'LOCALIZADO_RECENTE'); assert.equal(mon[2][idx('status')], 'LOCALIZADO_ANTIGO');
assert.equal(mon[3][idx('status')], 'SEM_PERMISSAO'); assert.equal(mon[4][idx('status')], 'NAO_ENCONTRADO_NA_PASTA');
assert.equal(mon[1][idx('observacao_manual')], 'observação minha', 'observação manual intacta'); assert.equal(mon[1][idx('validacao_manual')], 'conferido');
assert(estado().__drive.every((u: string) => /fields=id,modifiedTime,trashed,parents/.test(u) && !/alt=media|export/.test(u)), 'Drive: só metadados');
const hist = estado().sincronizacao; assert.deepEqual(hist.at(-1).slice(0, 4), ['DRIVE_METADADOS', '', 'monitoramento_documentos', 'MANUAL']);
// ---------- uma execução por vez (Drive lento) ----------
await fetch(`http://127.0.0.1:${PM}/__reset?atrasoDrive=400`);
const [c1, c2] = await Promise.all([get(idAdmin, '/api/documentos/sincronizar', 'POST'), get(idAdmin, '/api/documentos/sincronizar', 'POST')]);
resultado['duas sincronizações simultâneas'] = [c1.status, c2.status].sort(); assert.deepEqual([c1.status, c2.status].sort(), [200, 409]);
assert.equal(estado().__drive.length, 4, 'consultas ao Drive de uma única execução');
await fetch(`http://127.0.0.1:${PM}/__reset`);

// ---------- agendamento: os dois horários (Cron Trigger simulado pelo wrangler) ----------
const disparar = async (cron: string) => (await fetch(`${base}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent(cron)}`)).status;
const antesAg = estado().__drive.length;
resultado['cron 0 11 * * * (08:00 Brasília)'] = await disparar('0 11 * * *');
await new Promise(r => setTimeout(r, 1500));
assert.equal(estado().__drive.length, antesAg + 4, 'cron das 08:00 consultou o Drive');
resultado['cron 0 21 * * * (18:00 Brasília)'] = await disparar('0 21 * * *');
await new Promise(r => setTimeout(r, 1500));
assert.equal(estado().__drive.length, antesAg + 8, 'cron das 18:00 consultou o Drive');
resultado['cron desconhecido'] = await disparar('*/5 * * * *'); await new Promise(r => setTimeout(r, 800));
assert.equal(estado().__drive.length, antesAg + 8, 'cron fora dos dois horários é ignorado');
const modos = estado().sincronizacao.slice(1).map((x: string[]) => `${x[3]}|${(x[5].match(/cron=([^;]*)/) || [])[1] ?? ''}`);
assert(modos.includes('AGENDADO|0 11 * * *') && modos.includes('AGENDADO|0 21 * * *'), 'histórico registra os dois agendamentos: ' + modos.join(' , '));
resultado['histórico'] = modos;
const est = await get(idAdmin, '/api/documentos/estado'); resultado['estado'] = { ligada: est.corpo.ligada, agendamentos: est.corpo.agendamentos.map((a: any) => a.horario_brasilia), execucoes: est.corpo.historico.length };

// ---------- estrutura aditiva da avaliação: diagnóstico e criação somente-aditiva ----------
{
  const post = (id: string | null, corpo: unknown) => fetch(base + '/api/estrutura/avaliacao', { method: 'POST', headers: hdr(id), body: JSON.stringify(corpo) }).then(async x => ({ status: x.status, corpo: await x.json() as any }));
  const existentesAntes = JSON.stringify({ orientacoes: estado().orientacoes, frequencias: estado().frequencias });
  assert.equal((await get(null, '/api/estrutura/avaliacao')).status, 401);
  assert.equal((await get(idMon, '/api/estrutura/avaliacao')).status, 403, 'monitora não vê nem cria a estrutura');
  const d0 = await get(idAdmin, '/api/estrutura/avaliacao'); assert.equal(d0.status, 200);
  assert(d0.corpo.abas.every((a: any) => a.situacao === 'ausente'), 'antes: nenhuma aba existe');
  assert.equal((await post(idMon, { confirmo: 'CRIAR_ESTRUTURA_AVALIACAO', backup_checksum: 'a'.repeat(64) })).status, 403);
  let p = await post(idAdmin, {}); assert.equal(p.status, 400); assert.equal(p.corpo.code, 'CONFIRMACAO_AUSENTE');
  p = await post(idAdmin, { confirmo: 'CRIAR_ESTRUTURA_AVALIACAO', backup_checksum: 'xyz' }); assert.equal(p.status, 400, 'checksum de backup obrigatório');
  assert.equal(estado().config_avaliacao, undefined, 'nada criado sem confirmação');
  p = await post(idAdmin, { confirmo: 'CRIAR_ESTRUTURA_AVALIACAO', backup_checksum: 'a'.repeat(64) });
  assert.equal(p.status, 200, JSON.stringify(p.corpo)); assert.equal(p.corpo.criadas.length, 5);
  for (const n of ['config_avaliacao', 'rubricas_avaliacao', 'avaliacao_rascunhos', 'evidencias_avaliacao', 'rss_ajustes']) assert(estado()[n][0].length > 8 && estado()[n].length === 1, n + ' criada só com cabeçalho');
  assert.equal(JSON.stringify({ orientacoes: estado().orientacoes, frequencias: estado().frequencias }), existentesAntes, 'abas existentes intactas');
  p = await post(idAdmin, { confirmo: 'CRIAR_ESTRUTURA_AVALIACAO', backup_checksum: 'a'.repeat(64) }); assert.equal(p.corpo.criadas.length, 0); assert.equal(p.corpo.existentes.length, 5);
  const d1 = await get(idAdmin, '/api/estrutura/avaliacao'); assert(d1.corpo.abas.every((a: any) => a.situacao === 'ok'));
  resultado['estrutura da avaliação'] = { antes: 'ausente', criadas: 5, segunda_execucao: 'idempotente', abas_existentes: 'intactas' };
}

const ac = await get(idAdmin, '/api/acesso'); resultado['/api/acesso (administradora)'] = `${ac.status} ${ac.corpo.papel}`;
const am = await get(idMon, '/api/acesso'); resultado['/api/acesso (monitora)'] = `${am.status} ${am.corpo.papel} turmas=${am.corpo.turmas}`;
const big = await fetch(base + '/api/critical-write', { method: 'POST', headers: { 'X-Firebase-Id-Token': idAdmin }, body: 'x'.repeat(200000) }); resultado['corpo > 128 KB'] = big.status; assert.equal(big.status, 413);
const idxr = await fetch(base + '/'); resultado['arquivos estáticos'] = idxr.status; assert.equal(idxr.status, 200);
console.log(JSON.stringify(resultado, null, 2));
console.log('WORKER REAL: todos os cenários passaram');
