import { strict as assert } from 'node:assert';
import { criarAmbiente } from './ajudaAmbiente';
import { criarContaServicoDeTeste } from './ajudaContaServico';
import { limparCacheContaServico } from '../server/contaServico';
import { CRONS_SINCRONIZACAO, HORARIOS_BRASILIA, classificarDocumento, COLUNAS_ESCRITAS } from '../server/sincronizacaoDocumentos';

// ---------- agendamentos: 08:00 e 18:00 de Brasília ----------
assert.deepEqual([...CRONS_SINCRONIZACAO], ['0 11 * * *', '0 21 * * *'], 'expressões exigidas');
const horaBR = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
assert.equal(horaBR('2026-10-13T11:00:00Z'), '08:00'); assert.equal(horaBR('2026-10-13T21:00:00Z'), '18:00');
assert.equal(horaBR('2026-12-01T11:00:00Z'), '08:00', 'sem horário de verão em dezembro');
assert.deepEqual(HORARIOS_BRASILIA, { '0 11 * * *': '08:00', '0 21 * * *': '18:00' });

// ---------- classificação ----------
const agora = new Date('2026-10-13T12:00:00Z'), d = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();
assert.equal(classificarDocumento({ status: 200, corpo: { modifiedTime: d(2), parents: ['p1'] } }, 'p1', agora, 7).status, 'LOCALIZADO_RECENTE');
assert.equal(classificarDocumento({ status: 200, corpo: { modifiedTime: d(9), parents: ['p1'] } }, 'p1', agora, 7).status, 'LOCALIZADO_ANTIGO');
assert.equal(classificarDocumento({ status: 200, corpo: { modifiedTime: d(9) } }, '', agora, 14).status, 'LOCALIZADO_RECENTE', 'janela configurável');
assert.equal(classificarDocumento({ status: 200, corpo: { modifiedTime: d(1), parents: ['outra'] } }, 'p1', agora, 7).erro, 'FORA_DA_PASTA');
assert.equal(classificarDocumento({ status: 200, corpo: { trashed: true, modifiedTime: d(1) } }, '', agora, 7).status, 'NAO_ENCONTRADO_NA_PASTA');
assert.equal(classificarDocumento({ status: 403 }, '', agora, 7).status, 'SEM_PERMISSAO');
assert.equal(classificarDocumento({ status: 404 }, '', agora, 7).status, 'NAO_ENCONTRADO_NA_PASTA');
assert.equal(classificarDocumento({ status: 503 }, '', agora, 7).transitorio, true); assert.equal(classificarDocumento({ status: 0 }, '', agora, 7).erro, 'REDE');
assert.equal(classificarDocumento({ status: 200, corpo: {} }, '', agora, 7).status, 'A_CONFERIR', 'sem data nunca é recente');

// ---------- sincronização ponta a ponta (handler real do Worker, Drive e planilha simulados) ----------
const CAB = ['monitoramento_id', 'periodo_id', 'turma_id', 'titular_tipo', 'titular_id', 'tipo_documento_id', 'arquivo_id', 'pasta_id', 'data_modificacao_drive', 'consultado_em', 'status', 'origem_metadado', 'validacao_manual', 'erro_codigo', 'observacao_manual', 'x1', 'x2'];
const hoje = new Date();                                  // a sincronização usa o relógio real
const dh = (n: number) => new Date(hoje.getTime() - n * 86_400_000).toISOString();
const linhas = () => [CAB,
  ['m1', 'p', 't2b', 'MATRICULA', 'mO2', 'DIARIO_CAMPO', 'arqA', 'pasta1', '', '', '', 'CADASTRO_MANUAL', 'conferido pela professora', '', 'minha observação 1', '', ''],
  ['m2', 'p', 't3b', 'MATRICULA', 'mO3', 'DIARIO_CAMPO', 'arqB', 'pasta2', dh(40), 'antiga', 'LOCALIZADO_ANTIGO', 'CADASTRO_MANUAL', '', '', 'minha observação 2', '', ''],
  ['m3', 'p', 't1', 'GRUPO', 'g1', 'RELATORIO_GRUPO', 'arqC', 'pasta3', '', '', '', 'CADASTRO_MANUAL', '', '', '', '', ''],
  ['m4', 'p', 't1', 'GRUPO', 'g1', 'RELATORIO_GRUPO_ANEXO', 'arqC', 'pasta3', '', '', '', 'CADASTRO_MANUAL', '', '', '', '', ''],   // mesmo arquivo: 1 consulta
  ['m5', 'p', 't1', 'GRUPO', 'g2', 'RELATORIO_GRUPO', 'arqD', 'pasta4', '', '', '', 'CADASTRO_MANUAL', '', '', '', '', ''],
  ['m6', 'p', 't1', 'GRUPO', 'g3', 'RELATORIO_GRUPO', 'arqE', 'pasta5', '', '', '', 'CADASTRO_MANUAL', '', '', '', '', ''],
  ['m7', 'p', 't1', 'GRUPO', 'g4', 'RELATORIO_GRUPO', 'arqF', 'pasta6', dh(3), dh(1), 'LOCALIZADO_RECENTE', 'CADASTRO_MANUAL', '', '', '', '', ''],
  ['m8', 'p', 't1', 'GRUPO', 'g5', 'RELATORIO_GRUPO', 'arqG', 'pasta7', '', '', '', 'CADASTRO_MANUAL', '', '', '', '', ''],
  ['m9', 'p', 't1', 'MATRICULA', 'mZ', 'DIARIO_CAMPO', '', '', '', '', '', 'CADASTRO_MANUAL', '', '', '', '', ''],              // sem arquivo_id
];
const drive = {
  arqA: [200, { id: 'arqA', modifiedTime: dh(2), trashed: false, parents: ['pasta1'] }],
  arqB: [200, { id: 'arqB', modifiedTime: dh(40), trashed: false, parents: ['pasta2'] }],
  arqC: [200, { id: 'arqC', modifiedTime: dh(1), trashed: false, parents: ['pasta3'] }],
  arqD: [403, { error: { code: 403 } }],
  arqE: [200, { id: 'arqE', modifiedTime: dh(1), trashed: true, parents: ['pasta5'] }],
  arqF: [500, { error: { code: 500 } }],
  arqG: [200, { id: 'arqG', modifiedTime: dh(1), trashed: false, parents: ['outra-pasta'] }],
} as Record<string, [number, Record<string, unknown>]>;
const cs = await criarContaServicoDeTeste();
const ENV = { ADMIN_EMAILS: 'professora@exemplo.com', ACESSOS_JSON: JSON.stringify({ monitoras: [{ email: 'monitora@exemplo.com', turmas: ['t2b'], operacoes: ['DOCUMENTOS_VER'] }, { email: 'outra@exemplo.com', turmas: ['t2b'], operacoes: ['CHAMADA'] }] }),
  GOOGLE_SERVICE_ACCOUNT_JSON: cs.json, SINCRONIZACAO_DOCUMENTOS: 'ligada' };
const novoAmb = async (extra: Record<string, unknown> = {}, op: Record<string, unknown> = {}) => {
  limparCacheContaServico();
  return criarAmbiente({ abas: { monitoramento_documentos: linhas(), sincronizacao: [['fonte', 'arquivo_origem', 'aba_origem', 'modo', 'status_conexao', 'observacao', 'status_integracao', 'registros_lidos', 'registros_atualizados', 'mensagem_erro'], ['OUTRA_FONTE', 'x', 'y', 'z', 'OK', '', 'OK', '1', '1', '']], ...(op.abas as object ?? {}) },
    env: { ...ENV, ...extra }, drive, ...(op.resto as object ?? {}) });
};
const api = async (amb: Awaited<ReturnType<typeof novoAmb>>, email: string | null, caminho: string, metodo = 'GET') => {
  const headers: Record<string, string> = { Authorization: 'Bearer token-google-do-usuario' };
  if (email) headers['X-Firebase-Id-Token'] = await amb.emissor.token(email);
  const r = await fetch(caminho, { method: metodo, headers });
  return { status: r.status, corpo: await r.json() as any };
};
const idx = (n: string) => CAB.indexOf(n);

{
  const amb = await novoAmb();
  const antes = JSON.parse(JSON.stringify(amb.abas.monitoramento_documentos));
  // quem pode
  assert.equal((await api(amb, null, '/api/documentos/sincronizar', 'POST')).status, 401);
  assert.equal((await api(amb, 'aluna@exemplo.com', '/api/documentos/sincronizar', 'POST')).status, 403);
  assert.equal((await api(amb, 'monitora@exemplo.com', '/api/documentos/sincronizar', 'POST')).status, 403, 'monitora não sincroniza');
  assert.equal(amb.driveConsultas.length, 0, 'recusadas não chegam ao Drive');
  assert.equal((await api(amb, 'professora@exemplo.com', '/api/documentos/estado')).status, 200);
  assert.equal((await api(amb, 'monitora@exemplo.com', '/api/documentos/estado')).status, 200, 'DOCUMENTOS_VER permite ver o estado');
  assert.equal((await api(amb, 'outra@exemplo.com', '/api/documentos/estado')).status, 403, 'sem a operação, não vê');

  const r = await api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST');
  assert.equal(r.status, 200, JSON.stringify(r.corpo)); const x = r.corpo.resultado;
  assert.equal(x.modo, 'MANUAL'); assert.equal(x.lidos, 8, 'linha sem arquivo_id não é consultada'); assert.equal(x.consultados, 7, 'arquivo repetido consultado uma vez');
  assert.equal(x.status, 'PARCIAL', 'um erro técnico (500) torna a execução parcial'); assert.equal(x.erros.DRIVE_500, 1);
  // só metadados
  assert.equal(amb.driveConsultas.length, 7);
  for (const u of amb.driveConsultas) { const q = new URL(u).searchParams; assert.equal(q.get('fields'), 'id,modifiedTime,trashed,parents'); assert(!/alt=media|export|webViewLink|name|revisions/.test(u), 'nada além de metadados: ' + u); }
  // resultados por linha
  const t = amb.abas.monitoramento_documentos; const L = (id: string) => t.find(l => l[0] === id)!;
  assert.equal(L('m1')[idx('status')], 'LOCALIZADO_RECENTE'); assert.equal(L('m1')[idx('data_modificacao_drive')] !== '', true);
  assert.equal(L('m2')[idx('status')], 'LOCALIZADO_ANTIGO');
  assert.equal(L('m3')[idx('status')], 'LOCALIZADO_RECENTE'); assert.equal(L('m4')[idx('status')], 'LOCALIZADO_RECENTE', 'documento coletivo atualiza todas as linhas que o citam');
  assert.equal(L('m5')[idx('status')], 'SEM_PERMISSAO'); assert.equal(L('m5')[idx('erro_codigo')], 'DRIVE_403', 'permissão ≠ ausência');
  assert.equal(L('m6')[idx('status')], 'NAO_ENCONTRADO_NA_PASTA'); assert.equal(L('m6')[idx('erro_codigo')], 'LIXEIRA');
  assert.equal(L('m7')[idx('status')], 'LOCALIZADO_RECENTE', 'falha transitória não altera o último resultado conhecido'); assert.equal(L('m7')[idx('erro_codigo')], 'DRIVE_500');
  assert.equal(L('m7')[idx('data_modificacao_drive')], antes.find((l: any[]) => l[0] === 'm7')[idx('data_modificacao_drive')]);
  assert.equal(L('m8')[idx('status')], 'NAO_ENCONTRADO_NA_PASTA'); assert.equal(L('m8')[idx('erro_codigo')], 'FORA_DA_PASTA');
  assert.equal(L('m9')[idx('status')], '', 'sem arquivo_id: intacta');
  // integridade: sem linhas novas e só as 4 colunas autorizadas mudam
  assert.equal(t.length, antes.length, 'nenhuma linha criada ou duplicada');
  t.forEach((linha, i) => linha.forEach((v, c) => { if (!(COLUNAS_ESCRITAS as readonly string[]).includes(CAB[c])) assert.equal(v, antes[i][c], `coluna ${CAB[c]} da linha ${i + 1} deve permanecer intacta`); }));
  assert.equal(L('m1')[idx('observacao_manual')], 'minha observação 1'); assert.equal(L('m1')[idx('validacao_manual')], 'conferido pela professora');
  // histórico
  const hist = amb.abas.sincronizacao; assert.equal(hist.length, 3, 'linha anterior preservada + 1 nova');
  assert.deepEqual(hist[2].slice(0, 4), ['DRIVE_METADADOS', '', 'monitoramento_documentos', 'MANUAL']); assert.equal(hist[2][6], 'PARCIAL'); assert.equal(hist[2][7], '8');
  assert(/DRIVE_500×1/.test(hist[2][9]));
  assert.equal(amb.abas.log_alteracoes.at(-1)![5], 'SYNC'); assert.equal(amb.abas.log_alteracoes.at(-1)![2], 'sistema:sincronizacao-documentos');
  assert(!JSON.stringify(amb.abas.log_alteracoes).includes('minha observação'), 'sem texto manual no log');
  const est = (await api(amb, 'professora@exemplo.com', '/api/documentos/estado')).corpo;
  assert.equal(est.ligada, true); assert.equal(est.historico.length, 1); assert.deepEqual(est.agendamentos.map((a: any) => a.horario_brasilia), ['08:00', '18:00']);
  // segunda execução: nada novo é criado; consultado_em é renovado
  const consultado1 = L('m1')[idx('consultado_em')];
  await new Promise(r => setTimeout(r, 5));
  const r2 = await api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST'); assert.equal(r2.status, 200);
  assert.equal(amb.abas.monitoramento_documentos.length, antes.length); assert.notEqual(L('m1')[idx('consultado_em')], consultado1);
  assert.equal(r2.corpo.resultado.atualizados, 0, 'nada mudou no Drive: nenhuma linha "atualizada"');
  // as credenciais usadas foram as da conta de serviço
  assert(amb.chamadas.filter(c => c.url.includes('/v4/spreadsheets')).every(c => c.auth === 'Bearer token-conta-servico'));
  amb.restaurar();
}

// ---------- agendado: só liga com a variável; só nos dois horários ----------
{
  const amb = await novoAmb();
  const promessas: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => { promessas.push(p); } };
  await amb.worker.scheduled({ cron: '0 11 * * *' }, amb.envWorker, ctx); await Promise.all(promessas);
  assert.equal(amb.driveConsultas.length, 7, 'cron das 08:00 executa'); assert.equal(amb.abas.sincronizacao.at(-1)![3], 'AGENDADO'); assert(/cron=0 11 \* \* \*/.test(amb.abas.sincronizacao.at(-1)![5]));
  promessas.length = 0; const n = amb.driveConsultas.length;
  await amb.worker.scheduled({ cron: '0 21 * * *' }, amb.envWorker, ctx); await Promise.all(promessas);
  assert.equal(amb.driveConsultas.length, n + 7, 'cron das 18:00 executa'); assert(/cron=0 21 \* \* \*/.test(amb.abas.sincronizacao.at(-1)![5]));
  promessas.length = 0; const m = amb.driveConsultas.length;
  await amb.worker.scheduled({ cron: '*/5 * * * *' }, amb.envWorker, ctx); await Promise.all(promessas);
  assert.equal(amb.driveConsultas.length, m, 'cron desconhecido é ignorado');
  const hist = ((await api(amb, 'professora@exemplo.com', '/api/documentos/estado')).corpo.historico as any[]).map(h => `${h.modo}:${h.cron}`);
  assert.deepEqual(hist, ['AGENDADO:0 21 * * *', 'AGENDADO:0 11 * * *'], 'histórico de execuções com horário');
  amb.restaurar();
  const off = await novoAmb({ SINCRONIZACAO_DOCUMENTOS: 'desligada' });
  const p2: Promise<unknown>[] = [];
  await off.worker.scheduled({ cron: '0 11 * * *' }, off.envWorker, { waitUntil: p => { p2.push(p); } }); await Promise.all(p2);
  assert.equal(off.driveConsultas.length, 0, 'desligada: o cron não consulta o Drive');
  const man = await api(off, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST');
  assert.equal(man.status, 409); assert.equal(man.corpo.code, 'SINCRONIZACAO_DESLIGADA');
  off.restaurar();
}

// ---------- concorrência: uma execução por vez ----------
{
  const amb = await novoAmb({}, { resto: { atrasoDriveMs: 40 } });
  const [a, b] = await Promise.all([api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST'), api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], 'a segunda é recusada, não enfileirada');
  assert.equal([a, b].find(x => x.status === 409)!.corpo.code, 'SINCRONIZACAO_EM_ANDAMENTO');
  assert.equal(amb.driveConsultas.length, 7, 'o Drive foi consultado uma única vez por arquivo'); assert.equal(amb.abas.sincronizacao.length, 3, 'um único registro de histórico');
  const livre = await api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST'); assert.equal(livre.status, 200, 'depois de terminar, libera');
  amb.restaurar();
}

// ---------- falhas ----------
{
  // Drive recusa a conta de serviço
  let amb = await novoAmb({}, { resto: { drive: { arqA: [401, {}], arqB: [200, {}] } } });
  let r = await api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST');
  assert.equal(r.corpo.resultado.status, 'FALHA'); assert(r.corpo.resultado.erros.TOKEN_DRIVE_RECUSADO);
  assert.equal(amb.abas.monitoramento_documentos[1][idx('status')], '', 'falha total não grava nada'); assert.equal(amb.abas.sincronizacao.at(-1)![6], 'FALHA');
  amb.restaurar();
  // aba ausente / planilha indisponível / escrita recusada
  amb = await novoAmb({}, { resto: { falhas: { monitoramento_documentos: 400 } } });
  r = await api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST'); assert.equal(r.corpo.resultado.status, 'FALHA'); assert(r.corpo.resultado.erros.ABA_AUSENTE); amb.restaurar();
  amb = await novoAmb({}, { resto: { falhas: { monitoramento_documentos: 500 } } });
  r = await api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST'); assert.equal(r.corpo.resultado.status, 'FALHA'); assert(r.corpo.resultado.erros.SHEETS_500); amb.restaurar();
  // cabeçalho incompatível
  amb = await novoAmb({}, { abas: { monitoramento_documentos: [['coluna_qualquer'], ['x']] } });
  r = await api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST'); assert(r.corpo.resultado.erros.CABECALHO_INCOMPATIVEL); amb.restaurar();
  // sem conta de serviço: 503 e a falha fica no histórico do servidor
  amb = await novoAmb({ GOOGLE_SERVICE_ACCOUNT_JSON: undefined });
  r = await api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST'); assert.equal(r.status, 503); assert.equal(r.corpo.code, 'CONTA_SERVICO_INDISPONIVEL');
  const e = (await api(amb, 'professora@exemplo.com', '/api/documentos/estado')).corpo; assert.equal(e.historico[0].status, 'FALHA'); assert.equal(amb.driveConsultas.length, 0);
  amb.restaurar();
  // histórico indisponível não desfaz a sincronização
  amb = await novoAmb({}, { resto: { falhas: { sincronizacao: 500 } } });
  r = await api(amb, 'professora@exemplo.com', '/api/documentos/sincronizar', 'POST'); assert.equal(r.status, 200); assert.equal(r.corpo.historico_gravado, false);
  assert.equal(amb.abas.monitoramento_documentos[1][idx('status')], 'LOCALIZADO_RECENTE'); amb.restaurar();
}
console.log('Sincronização de documentos: só metadados, 4 colunas, sem duplicar, uma por vez, 08:00/18:00 e falhas validados.');

// ---------- wrangler.jsonc: agendamentos só podem existir exatamente como especificados ----------
{
  const { readFileSync } = await import('node:fs');
  const bruto = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const cfg = JSON.parse(bruto) as { triggers?: { crons?: string[] }; vars?: Record<string, string> };
  const crons = cfg.triggers?.crons ?? [];
  assert(crons.length === 0 || (crons.length === 2 && crons.includes('0 11 * * *') && crons.includes('0 21 * * *')), 'se houver Cron Triggers, devem ser exatamente 0 11 * * * e 0 21 * * *');
  assert.notEqual(cfg.vars?.SINCRONIZACAO_DOCUMENTOS, 'ligada', 'a sincronização só é ligada no ambiente, depois de validada com a planilha real');
  console.log(`wrangler.jsonc: Cron Triggers ${crons.length ? 'declarados (' + crons.join(' | ') + ')' : 'ainda não declarados (ativação pendente de validação real)'}.`);
}
