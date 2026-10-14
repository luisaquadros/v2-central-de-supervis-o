/**
 * Monitora vê o STATUS ADMINISTRATIVO das entregas de RSS (lista branca de colunas), nunca o conteúdo clínico,
 * nome de autor ou observações; sem escrita. Decisão no handler real do Worker. Dados sintéticos.
 */
import { strict as assert } from 'node:assert';
import { filtrarLeitura, tabelaLegivelPor, podeEscreverTabela } from '../server/acessos';
import { criarContaServicoDeTeste } from './ajudaContaServico';
import { criarAmbiente } from './ajudaAmbiente';

const M = 'monitora@exemplo.com', A = 'professora@exemplo.com';
const cab = ['registro_id', 'matricula_id', 'grupo_id', 'responsavel_matricula_id', 'origem_autor', 'responsavel_nome', 'escopo', 'turma_id', 'data_entrega', 'encontro_numero', 'local_pratica',
  'objetivos', 'tecnicas_atividades', 'manejo_resposta', 'compreensao_atual', 'proximo_passo', 'prioridade_supervisao', 'duvidas_supervisao', 'limitacoes', 'status', 'status_revisao', 'motivos_revisao', 'semana_rss', 'coluna_nova_clinica'];
const linha = (id: string, mat: string, turma: string, semana: number | '') => [id, mat, '', mat, 'Fulana', 'NOME-DA-AUTORA', 'INDIVIDUAL', turma, '2026-10-05', 3, 'Clínica-X',
  'CONTEUDO-CLINICO-OBJETIVOS', 'CONTEUDO-CLINICO-TECNICAS', 'CONTEUDO-CLINICO-MANEJO', 'CONTEUDO-CLINICO-COMPREENSAO', 'CONTEUDO-CLINICO-PROXIMO', 'Não', 'CONTEUDO-CLINICO-DUVIDAS', 'CONTEUDO-CLINICO-LIMITES', 'RECEBIDO', 'VALIDADO', 'MOTIVO-CLINICO', semana, 'COLUNA-NOVA-NAO-PREVISTA'];
const cs = await criarContaServicoDeTeste();
const abas: Record<string, any[][]> = {
  turmas: [['turma_id', 'nome'], ['t2b', '2B'], ['t3b', '3B']],
  matriculas: [['matricula_id', 'aluno_id', 'turma_id'], ['mA', 'a1', 't2b'], ['mB', 'a2', 't3b']],
  registros_semanais: [cab, linha('r1', 'mA', 't2b', 1), linha('r2', 'mA', 't2b', ''), linha('r3', 'mB', 't3b', 1)],
  status_rss_unidades: [['turma_id', 'unidade_id', 'unidade_tipo', 'unidade_nome', 'rss_esperados_ate_hoje', 'rss_recebidos_validos', 'saldo_rss', 'status_rss'], ['t2b', 'mA', 'INDIVIDUAL', 'Nome Real', 6, 2, -4, 'ATRASADO'], ['t3b', 'mB', 'INDIVIDUAL', 'Outro', 6, 1, -5, 'ATRASADO']],
  situacao_atual_turmas: [['turma_id', 'turma_nome', 'rss_esperados_ate_hoje', 'rss_total_previsto', 'unidades_em_dia', 'unidades_atrasadas', 'observacao_operacional'], ['t2b', '2B', 6, 12, 1, 3, 'OBSERVACAO-OPERACIONAL-PRIVADA']],
  rss_ajustes: [['ajuste_id', 'tipo', 'registro_id', 'turma_id', 'unidade_tipo', 'unidade_id', 'semana', 'observacao', 'status', 'criado_por'], ['aj1', 'OBSERVACAO', '', 't2b', 'MATRICULA', 'mA', 3, 'OBS-PRIVADA-DA-PROFESSORA', 'ATIVO', A]],
};
const amb = await criarAmbiente({ abas, env: { ADMIN_EMAILS: A, GOOGLE_SERVICE_ACCOUNT_JSON: cs.json,
  ACESSOS_JSON: JSON.stringify({ monitoras: [{ email: M, turmas: ['t2b'], operacoes: ['ENTREGAS'] }, { email: 'chamada@exemplo.com', turmas: ['t2b'], operacoes: ['CHAMADA'] }] }) } });
const chamar = async (email: string, caminho: string, metodo = 'GET', corpo?: unknown) => {
  const r = await fetch(caminho, { method: metodo, headers: { Authorization: 'Bearer token-google-do-usuario', 'Content-Type': 'application/json', 'X-Firebase-Id-Token': await amb.emissor.token(email) }, body: corpo ? JSON.stringify(corpo) : undefined });
  return { status: r.status, corpo: await r.json() as any };
};

// leitura com a delegação ENTREGAS: só colunas administrativas, só a turma delegada
let r = await chamar(M, '/api/leitura?tabelas=registros_semanais,status_rss_unidades,situacao_atual_turmas,rss_ajustes,matriculas');
assert.equal(r.status, 200, JSON.stringify(r.corpo).slice(0, 300));
const rs = r.corpo.tabelas.registros_semanais.values;
assert.deepEqual([...rs[0]].sort(), ['data_entrega', 'escopo', 'grupo_id', 'matricula_id', 'registro_id', 'semana_rss', 'status', 'status_revisao', 'turma_id'], 'somente a lista branca');
assert.deepEqual(rs.slice(1).map((l: any[]) => l[0]), ['r1', 'r2'], 'só a turma delegada');
const bruto = JSON.stringify(r.corpo);
for (const segredo of ['CONTEUDO-CLINICO', 'NOME-DA-AUTORA', 'MOTIVO-CLINICO', 'COLUNA-NOVA-NAO-PREVISTA', 'Clínica-X', 'Nome Real', 'OBSERVACAO-OPERACIONAL-PRIVADA', 'OBS-PRIVADA-DA-PROFESSORA'])
  assert(!bruto.includes(segredo), 'não pode sair: ' + segredo);
assert(!bruto.includes('"Outro"') && !JSON.stringify(r.corpo.tabelas.status_rss_unidades.values).includes('mB'), 'outra turma não sai');
assert.deepEqual(r.corpo.tabelas.status_rss_unidades.values[0], ['turma_id', 'unidade_id', 'unidade_tipo', 'rss_esperados_ate_hoje', 'rss_recebidos_validos', 'saldo_rss', 'status_rss']);
assert(!r.corpo.tabelas.rss_ajustes.values[0].includes('observacao'));

// sem a delegação ENTREGAS: negado
r = await chamar('chamada@exemplo.com', '/api/leitura?tabelas=registros_semanais'); assert.equal(r.status, 403);

// sem escrita: nada de RSS nem de correções
for (const tabela of ['registros_semanais', 'rss_ajustes']) {
  r = await chamar(M, '/api/critical-write', 'POST', { tabela, tipo: 'UPDATE', operacaoId: 'rss-op-' + tabela.slice(0, 5) + '0001', registro: { ajuste_id: 'aj1', registro_id: 'r1', status: 'REVOGADO' }, esperado: null });
  assert([400, 403].includes(r.status) && (tabela === 'rss_ajustes' ? r.status === 403 : true), `${tabela}: ${r.status} (registros_semanais nem é gravável pelo coordenador)`);
}
assert.equal(podeEscreverTabela({ papel: 'MONITORA', email: M, turmas: ['t2b'], operacoes: ['ENTREGAS'] }, 'rss_ajustes', 'INSERT').ok, false);
assert.equal(tabelaLegivelPor({ papel: 'MONITORA', email: M, turmas: ['t2b'], operacoes: ['CHAMADA'] }, 'registros_semanais'), false);

// unidade: filtrarLeitura com coluna de vínculo ausente não libera nada
assert.deepEqual(filtrarLeitura('registros_semanais', [['registro_id', 'semana_rss'], ['x', 1]], { papel: 'MONITORA', email: M, turmas: ['t2b'], operacoes: ['ENTREGAS'] }, { matriculas: [], grupos: [] }), [['registro_id', 'semana_rss']]);

// administradora lê tudo
r = await chamar(A, '/api/leitura?tabelas=registros_semanais'); assert.equal(r.corpo.tabelas.registros_semanais.values[0].length, cab.length);
amb.restaurar();
console.log('[PASS] Monitora: status administrativo de RSS por lista branca; sem conteúdo clínico, autoria, observações ou escrita; outra turma isolada.');
