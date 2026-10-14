/**
 * Etapa 9: monitoras contribuem qualitativamente (evidências PRELIMINARES), sem tocar em notas, rubricas, pesos,
 * rascunhos, frequência confirmada nem ocorrências. Decisão no servidor (handler real do Worker). Dados sintéticos.
 */
import { strict as assert } from 'node:assert';
import { validarContribuicaoMonitora, podeEscreverTabela, tabelaLegivelPor, filtrarLeitura, lerConfiguracaoAcessos } from '../server/acessos';
import { criarContaServicoDeTeste } from './ajudaContaServico';
import { criarAmbiente } from './ajudaAmbiente';
import { ABAS_AVALIACAO, evidenciaParaLinha, rubricaParaLinha } from '../services/estruturaAvaliacao';
import { criarRubricaDocumentacao } from '../services/rubricasAvaliacao';

const M = 'monitora@exemplo.com', A = 'professora@exemplo.com';
const perfilM = { papel: 'MONITORA' as const, email: M, turmas: ['t2b'], operacoes: ['CONTRIBUICAO_AVALIATIVA' as const] };
const contrib = (extra: Record<string, unknown> = {}) => ({ evidencia_id: 'c1', periodo_id: 'p1', turma_id: 't2b', matricula_id: 'mA', data: '2026-10-10',
  origem: 'CONTRIBUICAO_MONITORA', criterio_id: 'CRIT-DOC', subcriterio_id: 'DOC-REGISTROS', polaridade: 'DESENVOLVER', observacao: 'Registro do dia 10 sem a data da próxima sessão.',
  responsavel: M, referencia_tabela: 'documentos', referencia_id: 'd1', preliminar: 'TRUE', criado_em: '2026-10-10T10:00:00Z', atualizado_em: '2026-10-10T10:00:00Z', ...extra });

// ---------- unidade: validação linha a linha ----------
assert.equal(validarContribuicaoMonitora(perfilM, contrib(), null).ok, true);
assert.equal(validarContribuicaoMonitora(perfilM, contrib({ origem: 'OBSERVACAO_PROFESSORA' }), null).ok, false, 'só contribuição de monitora');
assert.equal(validarContribuicaoMonitora(perfilM, contrib({ preliminar: 'FALSE' }), null).ok, false, 'sempre preliminar');
assert.equal(validarContribuicaoMonitora(perfilM, contrib({ responsavel: 'outra@x.com' }), null).ok, false, 'autoria própria');
assert.equal(validarContribuicaoMonitora(perfilM, contrib({ observacao: 'x'.repeat(601) }), null).ok, false, 'objetiva e curta');
const dela = contrib();
assert.equal(validarContribuicaoMonitora(perfilM, { evidencia_id: 'c1', observacao: 'ajuste' }, dela).ok, true);
for (const campo of ['origem', 'responsavel', 'preliminar', 'turma_id', 'matricula_id']) {
  const alvo = campo === 'preliminar' ? 'FALSE' : campo === 'origem' ? 'SUPERVISAO' : 'x';
  assert.equal(validarContribuicaoMonitora(perfilM, { evidencia_id: 'c1', [campo]: alvo }, dela).ok, false, `não altera ${campo}`);
}
assert.equal(validarContribuicaoMonitora(perfilM, { evidencia_id: 'e9', observacao: 'x' }, contrib({ origem: 'OBSERVACAO_PROFESSORA', responsavel: A })).ok, false, 'evidência da professora é intocável');
assert.equal(validarContribuicaoMonitora(perfilM, { evidencia_id: 'c9', observacao: 'x' }, contrib({ responsavel: 'outra@x.com' })).ok, false, 'contribuição de outra monitora');
assert.equal(validarContribuicaoMonitora({ ...perfilM, papel: 'PROFESSORA_ADMIN' }, contrib({ origem: 'OBSERVACAO_PROFESSORA', preliminar: 'FALSE' }), null).ok, true);

// ---------- unidade: escrita e leitura por tabela ----------
for (const t of ['avaliacoes', 'avaliacoes_completas', 'criterios_avaliacao', 'config_avaliacao', 'rubricas_avaliacao', 'avaliacao_rascunhos', 'ocorrencias', 'frequencias', 'feedbacks'])
  assert.equal(podeEscreverTabela(perfilM, t, 'UPDATE').ok, false, `${t} fora da delegação`);
assert.equal(podeEscreverTabela(perfilM, 'evidencias_avaliacao', 'INSERT').ok, true);
assert.equal(podeEscreverTabela(perfilM, 'evidencias_avaliacao', 'DELETE').ok, false, 'sem exclusão');
assert.equal(podeEscreverTabela({ ...perfilM, operacoes: ['CHAMADA'] }, 'evidencias_avaliacao', 'INSERT').ok, false, 'depende da delegação');
for (const t of ['avaliacoes', 'avaliacoes_completas', 'avaliacao_rascunhos', 'config_avaliacao', 'ocorrencias', 'feedbacks', 'orientacoes', 'registros_supervisao'])
  assert.equal(tabelaLegivelPor(perfilM, t), false, `${t} não é legível por monitora`);
assert.equal(tabelaLegivelPor(perfilM, 'rubricas_avaliacao'), true);
assert.equal(tabelaLegivelPor({ ...perfilM, operacoes: ['CHAMADA'] }, 'rubricas_avaliacao'), false);
assert(lerConfiguracaoAcessos({ ACESSOS_JSON: JSON.stringify({ monitoras: [{ email: 'a@x.com', turmas: ['t1'], operacoes: ['CONTRIBUICAO_AVALIATIVA'] }] }) }).monitoras.has('a@x.com'));

// ---------- ponta a ponta no Worker ----------
const cs = await criarContaServicoDeTeste();
const cabEv = [...ABAS_AVALIACAO.evidencias_avaliacao.colunas] as string[];
const linhaEv = (o: Record<string, unknown>) => cabEv.map(c => String((o as any)[c] ?? ''));
const prof = evidenciaParaLinha({ evidencia_id: 'e1', periodo_id: 'p1', turma_id: 't2b', matricula_id: 'mA', data: '2026-10-09', origem: 'OBSERVACAO_PROFESSORA',
  polaridade: 'POSITIVO', observacao: 'AVALIACAO-RESERVADA-DA-PROFESSORA', responsavel: A, preliminar: false, criado_em: '', atualizado_em: '' });
const outra = contrib({ evidencia_id: 'c7', responsavel: 'outra@x.com', observacao: 'CONTRIBUICAO-DE-OUTRA-MONITORA' });
const rub = rubricaParaLinha(criarRubricaDocumentacao({ tipoEstagio: 'CLINICA_ADULTO', criterioId: 'CRIT-DOC', turmaId: 't2b', periodoId: 'p1', criadoPor: A, agora: '2026-10-01T00:00:00Z' }));
const cabRub = [...ABAS_AVALIACAO.rubricas_avaliacao.colunas] as string[];
const abas: Record<string, any[][]> = {
  periodos: [['periodo_id','status'],['p1','ATIVO']],
  criterios_avaliacao: [['criterio_id','turma_id','periodo_id'],['CRIT-DOC','t2b','p1']],
  turmas: [['turma_id', 'nome'], ['t2b', '2B'], ['t3b', '3B']],
  matriculas: [['matricula_id', 'aluno_id', 'turma_id'], ['mA', 'a1', 't2b'], ['mB', 'a2', 't3b']],
  alunos: [['aluno_id', 'nome', 'email'], ['a1', 'Estudante 1', 'e1@x.com'], ['a2', 'Estudante 2', 'e2@x.com']],
  evidencias_avaliacao: [cabEv, linhaEv(prof), linhaEv(outra)],
  rubricas_avaliacao: [cabRub, cabRub.map(c => String((rub as any)[c] ?? ''))],
  avaliacoes: [['avaliacao_id', 'matricula_id', 'criterio_id', 'nota'], ['v1', 'mA', 'CRIT-DOC', 1.25]],
  avaliacao_rascunhos: [[...ABAS_AVALIACAO.avaliacao_rascunhos.colunas], ['rs1', 'mA', '', 't2b']],
};
const amb = await criarAmbiente({ abas, env: {
  ADMIN_EMAILS: A, GOOGLE_SERVICE_ACCOUNT_JSON: cs.json,
  ACESSOS_JSON: JSON.stringify({ monitoras: [
    { email: M, turmas: ['t2b'], operacoes: ['CONTRIBUICAO_AVALIATIVA'] },
    { email: 'so-chamada@exemplo.com', turmas: ['t2b'], operacoes: ['CHAMADA'] },
  ] }) } });
const chamar = async (email: string, caminho: string, metodo = 'GET', corpo?: unknown) => {
  const r = await fetch(caminho, { method: metodo, headers: { Authorization: 'Bearer token-google-do-usuario', 'Content-Type': 'application/json', 'X-Firebase-Id-Token': await amb.emissor.token(email) }, body: corpo ? JSON.stringify(corpo) : undefined });
  return { status: r.status, corpo: await r.json() as any };
};
let n = 0;
const escrever = (email: string, tabela: string, tipo: string, registro: any, esperado: any = null) =>
  chamar(email, '/api/critical-write', 'POST', { tabela, tipo, operacaoId: `contrib-op-${String(++n).padStart(4, '0')}`, registro, esperado });

// monitora registra a própria contribuição preliminar (com a conta de serviço)
let r = await escrever(M, 'evidencias_avaliacao', 'INSERT', contrib());
assert.equal(r.status, 200, JSON.stringify(r.corpo));
assert.equal(abas.evidencias_avaliacao.length, 4);
assert.equal(amb.abas.log_alteracoes.at(-1)![2], M, 'log com a identidade verificada da monitora');
assert(!JSON.stringify(amb.abas.log_alteracoes).includes('próxima sessão'), 'log sem o texto da contribuição');
// tentativas indevidas
r = await escrever(M, 'evidencias_avaliacao', 'INSERT', contrib({ evidencia_id: 'c2', origem: 'OBSERVACAO_PROFESSORA' })); assert.equal(r.status, 403);
r = await escrever(M, 'evidencias_avaliacao', 'INSERT', contrib({ evidencia_id: 'c3', preliminar: 'FALSE' })); assert.equal(r.status, 403);
r = await escrever(M, 'evidencias_avaliacao', 'INSERT', contrib({ evidencia_id: 'c4', turma_id: 't3b', matricula_id: 'mB' })); assert.equal(r.corpo.code, 'FORA_DA_TURMA');
r = await escrever(M, 'evidencias_avaliacao', 'UPDATE', { evidencia_id: 'e1', observacao: 'alterada' }, evidenciaParaLinha({ ...(prof as any), preliminar: false })); assert.equal(r.status, 403, 'evidência da professora');
assert(abas.evidencias_avaliacao[1].includes('AVALIACAO-RESERVADA-DA-PROFESSORA'), 'evidência da professora intacta');
r = await escrever(M, 'evidencias_avaliacao', 'UPDATE', { evidencia_id: 'c7', observacao: 'alterada' }, outra); assert.equal(r.status, 403, 'contribuição de outra monitora');
r = await escrever(M, 'evidencias_avaliacao', 'DELETE', { evidencia_id: 'c1' }, contrib()); assert.equal(r.status, 403, 'sem exclusão');
r = await escrever(M, 'evidencias_avaliacao', 'UPDATE', { evidencia_id: 'c1', responsavel: 'outra@x.com' }, contrib()); assert.equal(r.status, 403, 'autoria imutável');
for (const [tabela, registro] of [['avaliacoes', { avaliacao_id: 'v1', nota: 10 }], ['avaliacao_rascunhos', { rascunho_id: 'rs1', status: 'CONFIRMADA' }],
  ['rubricas_avaliacao', { rubrica_chave: (rub as any).rubrica_chave, status: 'rascunho' }], ['config_avaliacao', { config_id: 'x', status: 'aprovada' }]] as const) {
  r = await escrever(M, tabela, 'UPDATE', registro as any, registro as any); assert.equal(r.status, 403, `${tabela} não delegada`);
}
assert.equal(abas.avaliacoes[1][3], 1.25, 'nota oficial intacta');
r = await escrever('so-chamada@exemplo.com', 'evidencias_avaliacao', 'INSERT', contrib({ evidencia_id: 'c5', responsavel: 'so-chamada@exemplo.com' })); assert.equal(r.status, 403, 'sem delegação');
// monitora atualiza a própria contribuição (versão atual)
r = await escrever(M, 'evidencias_avaliacao', 'UPDATE', { evidencia_id: 'c1', observacao: 'Registro do dia 10 completo após ajuste.' }, contrib());
assert.equal(r.status, 200, JSON.stringify(r.corpo));

// leitura: só as próprias contribuições + rubrica; nada de notas/rascunhos/evidências da professora
r = await chamar(M, '/api/leitura?tabelas=evidencias_avaliacao,rubricas_avaliacao,matriculas');
assert.equal(r.status, 200, JSON.stringify(r.corpo).slice(0, 300));
const ev = r.corpo.tabelas.evidencias_avaliacao.values;
assert.deepEqual(ev.slice(1).map((l: any[]) => l[0]), ['c1'], 'apenas a própria contribuição');
const bruto = JSON.stringify(r.corpo);
assert(!bruto.includes('AVALIACAO-RESERVADA') && !bruto.includes('CONTRIBUICAO-DE-OUTRA') && !bruto.includes('e1@x.com'));
assert(r.corpo.tabelas.rubricas_avaliacao.values.length === 2 && !r.corpo.tabelas.rubricas_avaliacao.values[0].includes('motivo_alteracao'));
for (const t of ['avaliacoes', 'avaliacao_rascunhos', 'config_avaliacao']) { r = await chamar(M, `/api/leitura?tabelas=${t}`); assert.equal(r.status, 403, t); }
r = await chamar('so-chamada@exemplo.com', '/api/leitura?tabelas=evidencias_avaliacao'); assert.equal(r.status, 403, 'sem delegação não lê');
// administradora vê tudo
r = await chamar(A, '/api/leitura?tabelas=evidencias_avaliacao'); assert.equal(r.corpo.tabelas.evidencias_avaliacao.values.length, 4);
// abas ainda inexistentes não derrubam a leitura da monitora
delete amb.abas.rubricas_avaliacao;
r = await chamar(M, '/api/leitura?tabelas=rubricas_avaliacao,matriculas'); assert.equal(r.status, 200, JSON.stringify(r.corpo).slice(0, 200));
assert.deepEqual(r.corpo.tabelas.rubricas_avaliacao.values, []);
amb.restaurar();
console.log('[PASS] Monitoras: contribuição preliminar própria; sem notas, rubricas, rascunhos, exclusão ou alteração de autoria; leitura filtrada; abas ausentes toleradas.');
