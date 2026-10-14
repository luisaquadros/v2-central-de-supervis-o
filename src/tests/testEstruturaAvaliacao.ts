/**
 * Estrutura aditiva da avaliação: persistência pelo coordenador (versão, conflito, log sem texto livre),
 * conversores linha↔domínio, diagnóstico do esquema e criação de abas que nunca toca nas existentes.
 * Dados sintéticos; nenhuma planilha real.
 */
import { strict as assert } from 'node:assert';
import { indexedDB } from 'fake-indexeddb';
Object.assign(globalThis, { window: { indexedDB } });
import { TABELAS_CRITICAS } from '../server/coordenacaoCritica';
import { ABAS_AVALIACAO, NOMES_ABAS_AVALIACAO, diagnosticarEstrutura, rubricaParaLinha, linhaParaRubrica, rascunhoParaLinha, linhaParaRascunho,
  configParaLinha, linhaParaConfig, ajusteParaLinha, linhaParaAjuste, evidenciaParaLinha, linhaParaEvidencia, configVigente, configPorCriterioDoAluno, type ConfigAvaliacao } from '../services/estruturaAvaliacao';
import { criarRubricaDocumentacao, novoRascunho, selecionarNivel, ajustarPontuacao, aprovarRubrica, novaVersaoRubrica } from '../services/rubricasAvaliacao';
import { criarEstruturaAvaliacao, lerCabecalhos } from '../server/estruturaAvaliacaoServidor';
import { calcularAvaliacao } from '../services/avaliacaoEngine';
import { entradasDaMatricula } from '../services/avaliacaoAdaptador';
const { salvarRegistroResiliente } = await import('../services/syncService');
const { salvarTabelasNoIndexedDb } = await import('../services/indexedDbService');
const { setMockToken } = await import('../services/googleSheetsService');
const { criarAmbiente } = await import('./ajudaAmbiente');

const T0 = '2026-10-14T10:00:00Z';
const rubrica = criarRubricaDocumentacao({ tipoEstagio: 'CLINICA_ADULTO', criterioId: 'CRIT-DOC', turmaId: 't1', periodoId: 'p1', criadoPor: 'prof', agora: T0 });
let rasc = novoRascunho({ rascunhoId: 'rs1', matriculaId: 'm1', escopo: 'INDIVIDUAL', rubrica, agora: T0, por: 'prof' });
rasc = selecionarNivel(rasc, 'DOC-RACIOCINIO', 'ADEQUADO', 'prof', T0);
rasc = ajustarPontuacao(rasc, 'DOC-ETICA', 0.3, 'JUSTIFICATIVA-CONFIDENCIAL-NAO-LOGAR', 'prof', T0);
const config: ConfigAvaliacao = { config_id: 'CFG-t1-CRIT-DOC-p1-v1', periodo_id: 'p1', turma_id: 't1', criterio_id: 'CRIT-DOC', versao: 1, status: 'aprovada',
  tipo_calculo: 'hybrid', tipo_estagio: 'CLINICA_ADULTO', config: { agregacao: 'soma' }, rubrica_id: rubrica.rubrica_id, criado_em: T0, criado_por: 'prof', aprovado_em: T0, aprovado_por: 'prof' };
const evid = { evidencia_id: 'ev1', periodo_id: 'p1', turma_id: 't1', matricula_id: 'm1', data: '2026-10-10', origem: 'SUPERVISAO' as const, criterio_id: 'CRIT-DOC',
  polaridade: 'POSITIVO' as const, observacao: 'Discussão fundamentada do caso', responsavel: 'prof', referencia_tabela: 'registros_supervisao', referencia_id: 'r9', preliminar: false, criado_em: T0, atualizado_em: T0 };

// RSS: ajuste ida e volta
const aj1 = { ajuste_id: 'AJ-9', tipo: 'OBSERVACAO' as const, turma_id: 't1', unidade_tipo: 'GRUPO' as const, unidade_id: 'g1', semana: 3, observacao: 'Entregou por e-mail', status: 'ATIVO' as const, criado_em: T0, criado_por: 'prof' };
assert.deepEqual(JSON.parse(JSON.stringify(linhaParaAjuste(ajusteParaLinha(aj1)))), JSON.parse(JSON.stringify({ ...aj1, registro_id: undefined, semana_original: null, unidade_original_tipo: null, unidade_original_id: null, atualizado_em: T0 })));
assert.equal(linhaParaAjuste({ status: 'qualquer', tipo: 'x' }).status, 'ATIVO');
// --- Todas as abas novas passam pelo coordenador
for (const aba of NOMES_ABAS_AVALIACAO) assert(TABELAS_CRITICAS.has(aba), `${aba} deve ser crítica`);
assert.equal(NOMES_ABAS_AVALIACAO.length, 5, '4 da avaliação + rss_ajustes');

const limpo = (x: unknown) => JSON.parse(JSON.stringify(x)); // ignora chaves indefinidas
// --- Conversores: ida e volta sem perda; JSON inválido é detectado, nunca vira vazio silencioso
const rl = linhaParaRubrica(rubricaParaLinha(rubrica));
assert.deepEqual(limpo(rl.rubrica), limpo(rubrica));
assert.equal(linhaParaRubrica({ ...rubricaParaLinha(rubrica), subcriterios_json: '{quebrado' }).rubrica, null);
const rr = linhaParaRascunho(rascunhoParaLinha(rasc, 't1', 'prof'));
assert.deepEqual(limpo(rr.rascunho), limpo(rasc));
assert.equal(linhaParaRascunho({ ...rascunhoParaLinha(rasc, 't1', 'prof'), selecoes_json: '[' }).rascunho, null);
assert.deepEqual(limpo(linhaParaConfig(configParaLinha(config)).config), limpo(config));
assert.equal(linhaParaConfig({ ...configParaLinha(config), tipo_calculo: 'misterioso' }).config, null);
assert.deepEqual(limpo(linhaParaEvidencia(evidenciaParaLinha(evid))), limpo(evid));
assert.equal(linhaParaEvidencia({ ...evidenciaParaLinha(evid), preliminar: 'TRUE', origem: 'INVENTADA' }).origem, 'OBSERVACAO_PROFESSORA');

// --- Configuração por turma/período: versão aprovada mais recente; outra turma não herda
const v2: ConfigAvaliacao = { ...config, config_id: 'CFG-v2', versao: 2, tipo_calculo: 'manual', config: {} };
const rascunhoCfg: ConfigAvaliacao = { ...config, config_id: 'CFG-v3', versao: 3, status: 'rascunho' };
assert.equal(configVigente([config, v2, rascunhoCfg], 't1', 'p1', 'CRIT-DOC')!.versao, 2, 'versão em rascunho não vigora');
assert.equal(configVigente([config], 't2', 'p1', 'CRIT-DOC'), null, 'outra turma sem configuração');
assert.equal(configVigente([config], 't1', 'p2', 'CRIT-DOC'), null, 'outro período sem configuração');

// --- Engine com configuração + rascunho: prévia vem da rubrica; oficial preservada
const criterios: any[] = [{ criterio_id: 'CRIT-DOC', turma_id: 't1', disciplina_id: 'd1', nome: 'Documentação da prática', nota_maxima: 2.5, ordem: 1, ativo: true }];
const oficiais: any[] = [{ avaliacao_id: 'a1', matricula_id: 'm1', criterio_id: 'CRIT-DOC', nota: 1.25, observacao: '' }];
const cfgAluno = configPorCriterioDoAluno({ configs: [config], rubricas: [rubrica], rascunhos: [rasc], turmaId: 't1', periodoId: 'p1', criterioIds: ['CRIT-DOC'], matriculaId: 'm1' });
const res = calcularAvaliacao(entradasDaMatricula(criterios, oficiais, 'm1', 't1', {}, cfgAluno));
assert.equal(res.totalOficial, 1.25, 'nota oficial preservada');
assert.equal(res.criterios[0].previa, null, 'rubrica incompleta: sem prévia');
assert.equal(res.criterios[0].subcriterios.length, 6, 'subcritérios da rubrica visíveis');
// rubrica NÃO aprovada nunca calcula
const rubRasc = { ...rubrica, status: 'rascunho' as const };
const cfgNaoAprov = configPorCriterioDoAluno({ configs: [config], rubricas: [rubRasc], rascunhos: [rasc], turmaId: 't1', periodoId: 'p1', criterioIds: ['CRIT-DOC'], matriculaId: 'm1' });
assert.equal(cfgNaoAprov['CRIT-DOC'].config!.agregacao, undefined);
// sem configuração aprovada: critério continua manual
assert.deepEqual(configPorCriterioDoAluno({ configs: [], rubricas: [], rascunhos: [], turmaId: 't1', periodoId: 'p1', criterioIds: ['CRIT-DOC'], matriculaId: 'm1' }), {});
// nova versão da rubrica não altera retroativamente o rascunho do aluno
const rubV2 = aprovarRubrica(novaVersaoRubrica(rubrica, { subcriterios: rubrica.subcriterios.map(s => s.subcriterio_id === 'DOC-RACIOCINIO' ? { ...s, peso: 0.55 } : s.subcriterio_id === 'DOC-REGISTROS' ? { ...s, peso: 0.6 } : s), criadoPor: 'prof', agora: T0, motivo: 'm', valorCriterio: 2.5 }), 'prof', T0);
const cfgV2 = configPorCriterioDoAluno({ configs: [config], rubricas: [rubrica, rubV2], rascunhos: [rasc], turmaId: 't1', periodoId: 'p1', criterioIds: ['CRIT-DOC'], matriculaId: 'm1' });
assert.equal(cfgV2['CRIT-DOC'].subcriterios!.find(s => s.id === 'DOC-RACIOCINIO')!.maxPontos, 0.65, 'rascunho continua na v1');

// --- Diagnóstico do esquema
const ausentes = diagnosticarEstrutura({});
assert(ausentes.every(d => d.situacao === 'ausente'));
const completo = diagnosticarEstrutura(Object.fromEntries(NOMES_ABAS_AVALIACAO.map(n => [n, [...ABAS_AVALIACAO[n].colunas]])));
assert(completo.every(d => d.situacao === 'ok'));
const parcial = diagnosticarEstrutura({ config_avaliacao: ['config_id', 'extra_do_usuario'] });
assert.equal(parcial[0].situacao, 'colunas_faltando'); assert(parcial[0].extras.includes('extra_do_usuario'));

const vinculosFicticios = () => ({
  periodos: [['periodo_id','status'],['p1','ATIVO']],
  turmas: [['turma_id','periodo_id'],['t1','p1'],['t2','p1']],
  matriculas: [['matricula_id','turma_id','periodo_id'],['m1','t1','p1']],
  grupos_pratica: [['grupo_id','turma_id','periodo_id'],['g1','t1','p1']],
  criterios_avaliacao: [['criterio_id','turma_id','periodo_id'],['CRIT-DOC','t1','p1']],
});

// --- Persistência pelo coordenador: inserção, atualização, conflito e log sem texto livre
const casos: Array<{ aba: (typeof NOMES_ABAS_AVALIACAO)[number]; linha: Record<string, unknown>; campo: string; novo: string }> = [
  { aba: 'config_avaliacao', linha: configParaLinha(config), campo: 'status', novo: 'arquivada' },
  { aba: 'rubricas_avaliacao', linha: rubricaParaLinha(rubrica), campo: 'status', novo: 'rascunho' },
  { aba: 'avaliacao_rascunhos', linha: rascunhoParaLinha(rasc, 't1', 'prof'), campo: 'status', novo: 'CONFIRMADA' },
  { aba: 'avaliacao_rascunhos', linha: rascunhoParaLinha(novoRascunho({ rascunhoId: 'rs-grupo', matriculaId: 'GRUPO:g1', grupoId: 'g1', escopo: 'COLETIVA', rubrica, agora: T0, por: 'prof' }), 't1', 'prof'), campo: 'status', novo: 'CONFIRMADA' },
  { aba: 'evidencias_avaliacao', linha: evidenciaParaLinha(evid), campo: 'polaridade', novo: 'DESENVOLVER' },
  { aba: 'rss_ajustes', linha: ajusteParaLinha({ ajuste_id: 'AJ-1', tipo: 'ASSOCIAR', registro_id: 'r1', turma_id: 't1', semana: 4, semana_original: null, status: 'ATIVO', criado_em: T0, criado_por: 'prof' }), campo: 'status', novo: 'REVOGADO' },
];
for (const c of casos) {
  const cab: string[] = [...ABAS_AVALIACAO[c.aba].colunas];
  const pk: string = ABAS_AVALIACAO[c.aba].pk;
  const amb = await criarAmbiente({ abas: { ...vinculosFicticios(), [c.aba]: [cab] } });
  setMockToken('ficticio');
  await salvarTabelasNoIndexedDb({ [c.aba]: [] });
  // 1) INSERT
  const ins = await salvarRegistroResiliente(c.aba, 'INSERT', c.linha);
  assert.equal(ins.gravadoOnline, true, `${c.aba}: inserção confirmada`);
  assert.equal(amb.abas[c.aba].length, 2);
  assert.equal(String(amb.abas[c.aba][1][cab.indexOf(pk)]), String(c.linha[pk]));
  if (c.aba === 'avaliacao_rascunhos' && c.linha.escopo === 'COLETIVA') {
    amb.abas.grupos_pratica.push(['g-outra','t2','p1']);
    const resposta = await fetch('/api/critical-write', { method:'POST', headers:{ Authorization:'Bearer ficticio', 'Content-Type':'application/json', 'X-Firebase-Id-Token':await amb.emissor.token('professora@exemplo.com') }, body:JSON.stringify({ tabela:c.aba,tipo:'INSERT',operacaoId:'rascunho-grupo-turma-invalida',registro:{...c.linha,rascunho_id:'rs-invalido',grupo_id:'g-outra',matricula_id:'GRUPO:g-outra'},esperado:null }) });
    assert.equal(resposta.status,409,'grupo de outra turma recusado');
    assert.equal((await resposta.json() as any).code,'VINCULO_INCONSISTENTE');
    assert.equal(amb.abas[c.aba].length,2,'rascunho inválido não persistido');
  }
  // 2) UPDATE só da coluna alterada; outras preservadas
  await salvarTabelasNoIndexedDb({ [c.aba]: [c.linha] });
  const antes = amb.abas[c.aba][1].map(String);
  const up = await salvarRegistroResiliente(c.aba, 'UPDATE', { [pk]: c.linha[pk], [c.campo]: c.novo });
  assert.equal(up.gravadoOnline, true);
  const i = cab.indexOf(c.campo);
  assert.equal(String(amb.abas[c.aba][1][i]), c.novo);
  cab.forEach((_, k) => { if (k !== i) assert.equal(String(amb.abas[c.aba][1][k]), antes[k], `${c.aba}.${cab[k]} preservada`); });
  // 3) conflito de versão preserva o valor do outro aparelho
  await salvarTabelasNoIndexedDb({ [c.aba]: [c.linha] });
  await assert.rejects(() => salvarRegistroResiliente(c.aba, 'UPDATE', { [pk]: c.linha[pk], [c.campo]: 'OUTRO' }), /CONFLITO_VERSAO/);
  assert.equal(String(amb.abas[c.aba][1][i]), c.novo);
  // 4) o log nunca contém justificativas, observações nem JSON de conteúdo
  const logTexto = JSON.stringify(amb.abas.log_alteracoes);
  assert(!logTexto.includes('JUSTIFICATIVA-CONFIDENCIAL-NAO-LOGAR'), `${c.aba}: log sem justificativa`);
  assert(!logTexto.includes('Discussão fundamentada'), `${c.aba}: log sem observação`);
  amb.restaurar();
  console.log(`  ${c.aba}: inserção, atualização, conflito e log validados`);
}
// atualização de texto livre: o log registra '(texto)' e não o conteúdo
{
  const aba = 'evidencias_avaliacao' as const;
  const cab = [...ABAS_AVALIACAO[aba].colunas];
  const e2 = evidenciaParaLinha({ ...evid, evidencia_id: 'ev2' });
  const amb = await criarAmbiente({ abas: { ...vinculosFicticios(), [aba]: [cab, cab.map(c => String((e2 as any)[c] ?? ''))] } });
  setMockToken('ficticio');
  await salvarTabelasNoIndexedDb({ [aba]: [e2] });
  await salvarRegistroResiliente(aba, 'UPDATE', { evidencia_id: 'ev2', observacao: 'TEXTO-SENSIVEL-NOVO' });
  assert(!JSON.stringify(amb.abas.log_alteracoes).includes('TEXTO-SENSIVEL-NOVO'));
  amb.restaurar();
}

// --- Criação aditiva de abas (servidor), com planilha simulada em memória
function planilhaFalsa(abas: Record<string, string[][]>) {
  const chamadas: string[] = [];
  const chamar = async (url: string, init: RequestInit = {}) => {
    chamadas.push((init.method || 'GET') + ' ' + decodeURIComponent(url).replace(/^.*\/spreadsheets\/[^/:?]+/, ''));
    if (url.includes('?fields=')) return { sheets: Object.keys(abas).map(title => ({ properties: { title } })) };
    if (url.includes('values:batchGet')) {
      const ranges = [...decodeURIComponent(url).matchAll(/ranges='([^']+)'!1:1/g)].map(m => m[1]);
      return { valueRanges: ranges.map(r => ({ values: abas[r]?.slice(0, 1) || [] })) };
    }
    if (url.endsWith(':batchUpdate')) {
      for (const r of JSON.parse(String(init.body)).requests) { const t = r.addSheet.properties.title; if (abas[t]) throw new Error('já existe'); abas[t] = []; }
      return {};
    }
    const m = /\/values\/'?([^'!]+)'?!A1/.exec(decodeURIComponent(url));
    if (m && init.method === 'PUT') { abas[m[1]] = JSON.parse(String(init.body)).values; return {}; }
    throw new Error('chamada inesperada ' + url);
  };
  return { abas, chamar, chamadas };
}
{
  const existentes = { alunos: [['aluno_id', 'nome'], ['a1', 'Estudante 1']], avaliacoes: [['avaliacao_id', 'nota'], ['1', '1,5']] };
  const snapshot = JSON.stringify(existentes);
  const p = planilhaFalsa(JSON.parse(snapshot));
  const rel = await criarEstruturaAvaliacao('https://sheets.test/v4/spreadsheets/ID', p.chamar);
  assert.deepEqual(rel.criadas.sort(), [...NOMES_ABAS_AVALIACAO].sort());
  for (const n of NOMES_ABAS_AVALIACAO) assert.deepEqual(p.abas[n], [[...ABAS_AVALIACAO[n].colunas]]);
  assert.equal(JSON.stringify({ alunos: p.abas.alunos, avaliacoes: p.abas.avaliacoes }), snapshot, 'abas existentes intactas');
  // idempotente: segunda execução não cria nem altera nada
  const antes = JSON.stringify(p.abas); const n0 = p.chamadas.length;
  const rel2 = await criarEstruturaAvaliacao('https://sheets.test/v4/spreadsheets/ID', p.chamar);
  assert.equal(rel2.criadas.length, 0); assert.equal(rel2.existentes.length, 5);
  assert.equal(JSON.stringify(p.abas), antes);
  assert(p.chamadas.slice(n0).every(c => c.startsWith('GET')), 'segunda execução só lê');
  // aba existente com cabeçalho diferente: relatada, não modificada
  const q = planilhaFalsa({ config_avaliacao: [['config_id', 'coluna_do_usuario'], ['x', 'y']] });
  const rel3 = await criarEstruturaAvaliacao('https://sheets.test/v4/spreadsheets/ID', q.chamar);
  assert.equal(rel3.divergentes.length, 1); assert.equal(rel3.divergentes[0].aba, 'config_avaliacao');
  assert.deepEqual(q.abas.config_avaliacao, [['config_id', 'coluna_do_usuario'], ['x', 'y']], 'divergente não é alterada');
  assert.equal(rel3.criadas.length, 4);
  assert.deepEqual(Object.keys(await lerCabecalhos('https://sheets.test/v4/spreadsheets/ID', q.chamar)).sort(), [...NOMES_ABAS_AVALIACAO].sort());
}

console.log('[PASS] Estrutura aditiva da avaliação: conversores, configuração por turma/período, persistência pelo coordenador, log sem texto livre e criação idempotente de abas.');
