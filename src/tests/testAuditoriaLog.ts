import assert from 'node:assert/strict';
import { WriteCoordinator } from '../server/worker';
import { valorComparavel, valorComparavelCampo, resumirAlteracaoParaLog, TABELAS_CRITICAS, COLUNAS_LOG_ALTERACOES } from '../server/coordenacaoCritica';

// ---- Formato de data diferente não pode virar conflito falso ----
assert.equal(valorComparavel('13/10/2026'), valorComparavel('2026-10-13'));
assert.equal(valorComparavel(46308), valorComparavel('2026-10-13'));
assert.notEqual(valorComparavel('14/10/2026'), valorComparavel('2026-10-13'));
assert.equal(valorComparavel('Set/2026'), 'Set/2026', 'texto livre de data não é alterado');
assert.equal(valorComparavel(true), 'TRUE');
assert.equal(valorComparavel('true'), valorComparavel(true), 'TRUE/true da planilha');
assert.equal(valorComparavelCampo('horarios_turma', 'dia_semana', 'Terça'), valorComparavelCampo('horarios_turma', 'dia_semana', 2), 'nome do dia = número');
assert.notEqual(valorComparavelCampo('horarios_turma', 'dia_semana', 'Quarta'), valorComparavelCampo('horarios_turma', 'dia_semana', 2));
assert.equal(valorComparavelCampo('turmas', 'dia_semana', 'Terça'), 'Terça', 'só vale em horarios_turma');

// ---- Função pura: só campos alterados; texto livre nunca vai para o log ----
{
  const cab = ['ocorrencia_id', 'matricula_id', 'tipo', 'status', 'observacao', 'atualizado_em'];
  const antes = { ocorrencia_id: 'o1', matricula_id: 'm1', tipo: 'ATRASO', status: 'ABERTA', observacao: 'texto sensível do caso', atualizado_em: '1' };
  const r = resumirAlteracaoParaLog('ocorrencias', 'UPDATE',
    { ocorrencia_id: 'o1', matricula_id: 'm1', tipo: 'ATRASO', status: 'RESOLVIDA', observacao: 'outro texto sensível', atualizado_em: '2' }, antes, cab);
  assert.deepEqual(r.campos, ['status', 'observacao'], 'só o que mudou; sem campos técnicos');
  assert.equal(r.antes.status, 'ABERTA'); assert.equal(r.depois.status, 'RESOLVIDA');
  assert.equal(r.antes.observacao, '(texto)'); assert.equal(r.depois.observacao, '(texto)');
  assert(!JSON.stringify(r).includes('sensível'), 'conteúdo de texto livre não pode aparecer no log');
  const ins = resumirAlteracaoParaLog('ocorrencias', 'INSERT', { ocorrencia_id: 'o2', matricula_id: 'm1', status: 'ABERTA' }, null, cab);
  assert.deepEqual(ins.antes, {}); assert.equal(ins.depois.status, 'ABERTA');
  const del = resumirAlteracaoParaLog('ocorrencias', 'DELETE', { ocorrencia_id: 'o1' }, antes, cab);
  assert.equal(del.antes.status, 'ABERTA'); assert.deepEqual(del.depois, {});
}
for (const t of ['ocorrencias', 'orientacoes', 'feedbacks', 'feedback_alunos', 'pontos_acompanhamento', 'registros_supervisao', 'preparacoes_aula'])
  assert(TABELAS_CRITICAS.has(t), `${t} deve passar pelo coordenador`);
for (const t of ['periodos', 'disciplinas', 'turmas_origem', 'configuracoes', 'registros_semanais'])
  assert(!TABELAS_CRITICAS.has(t), `${t} fica no caminho direto nesta etapa`);

// ---- Worker: log gravado, idempotente e tolerante a falha ----
const abas: Record<string, any[][]> = { ocorrencias: [['ocorrencia_id', 'matricula_id', 'status', 'observacao'], ['o1', 'm1', 'ABERTA', 'segredo']] };
let falhaLog = false;
const ok = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });
const velho = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = String(input); const m = init?.method || 'GET';
  const aba = decodeURIComponent(url).match(/values\/'([^'!]+)'/)?.[1];
  if (url.includes('fields=sheets')) return ok({ sheets: Object.keys(abas).map(t => ({ properties: { title: t, sheetId: 1 } })) });
  if (url.endsWith(':batchUpdate') && !url.includes('/values:') && m === 'POST') {
    const req = JSON.parse(String(init!.body)).requests?.[0]?.addSheet; if (req) abas[req.properties.title] = []; return ok({});
  }
  if (aba === 'log_alteracoes' && falhaLog) return new Response('{}', { status: 500 });
  if (url.includes('/values:batchUpdate')) {
    for (const p of JSON.parse(String(init!.body)).data) {
      const [, col, row] = p.range.match(/!([A-Z]+)(\d+)$/)!; abas.ocorrencias[Number(row) - 1][col.charCodeAt(0) - 65] = p.values[0][0];
    } return ok({});
  }
  if (m === 'PUT' && aba) { abas[aba][0] = JSON.parse(String(init!.body)).values[0]; return ok({}); }
  if (url.includes(':append?') && aba) { (abas[aba] ??= []).push(JSON.parse(String(init!.body)).values[0]); return ok({}); }
  if (aba) return ok({ values: abas[aba] });
  throw Error('inesperado ' + m + ' ' + url);
}) as typeof fetch;
try {
  const store = new Map<string, unknown>();
  const srv = new WriteCoordinator({ storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => { store.set(k, v); } } } as any, {} as any);
  const enviar = (id: string, status: string, obs: string, esperado: any) => srv.fetch(new Request('https://i/w', {
    method: 'POST', headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json', 'X-Usuario-Verificado': 'prof@exemplo.com', 'X-Perfil': JSON.stringify({papel:'PROFESSORA_ADMIN',email:'prof@exemplo.com',turmas:['*'],operacoes:['CHAMADA','ENTREGAS','DOCUMENTOS_VER']}) },
    body: JSON.stringify({ tabela: 'ocorrencias', tipo: 'UPDATE', operacaoId: id, usuario: 'falsificado@x.com', esperado,
      registro: { ocorrencia_id: 'o1', matricula_id: 'm1', status, observacao: obs } }),
  }));
  const base = { ocorrencia_id: 'o1', matricula_id: 'm1', status: 'ABERTA', observacao: 'segredo' };

  const r1 = await (await enviar('op-log-0001', 'RESOLVIDA', 'novo segredo', base)).json();
  assert.equal(r1.ok, true); assert.equal(r1.auditoria, true);
  assert.deepEqual(abas.log_alteracoes[0], [...COLUNAS_LOG_ALTERACOES], 'aba do log criada com cabeçalho');
  assert.equal(abas.log_alteracoes.length, 2);
  const linha = abas.log_alteracoes[1];
  assert.equal(linha[0], 'op-log-0001'); assert.equal(linha[2], 'prof@exemplo.com', 'usuário vem da identidade verificada, não do corpo'); assert.equal(linha[3], 'ocorrencias');
  assert.equal(linha[4], 'o1'); assert.equal(linha[5], 'UPDATE'); assert.equal(linha[6], 'status, observacao');
  assert(!linha.join('|').includes('segredo'), 'texto livre fora do log');

  const rep = await (await enviar('op-log-0001', 'RESOLVIDA', 'novo segredo', base)).json();
  assert.equal(rep.replayed, true); assert.equal(abas.log_alteracoes.length, 2, 'reenvio não duplica o log');

  const velhaVersao = await enviar('op-log-0002', 'ABERTA', 'x', base);
  assert.equal(velhaVersao.status, 409); assert.equal(abas.log_alteracoes.length, 2, 'conflito não gera log de alteração');

  // Falha no log: a gravação vale, o log fica pendente e sobe na operação seguinte.
  falhaLog = true;
  const atual = { ...base, status: 'RESOLVIDA', observacao: 'novo segredo' };
  const r3 = await (await enviar('op-log-0003', 'ABERTA', 'novo segredo', atual)).json();
  assert.equal(r3.ok, true); assert.equal(r3.auditoria, false, 'avisa que o log não foi gravado');
  assert.equal(abas.ocorrencias[1][2], 'ABERTA', 'a gravação não é desfeita');
  assert.equal((store.get('logs-pendentes') as string[][]).length, 1);
  falhaLog = false;
  const r4 = await (await enviar('op-log-0004', 'RESOLVIDA', 'novo segredo', { ...atual, status: 'ABERTA' })).json();
  assert.equal(r4.auditoria, true);
  assert.deepEqual(abas.log_alteracoes.slice(2).map(l => l[0]), ['op-log-0003', 'op-log-0004'], 'pendente sobe antes, em ordem');
  assert.equal((store.get('logs-pendentes') as string[][]).length, 0);
  console.log('Auditoria: log por alteração, sem texto livre, idempotente e com reenvio validado.');
} finally { globalThis.fetch = velho; }
