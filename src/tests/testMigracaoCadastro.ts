/**
 * Migração, uma tabela por vez, das tabelas de cadastro para o coordenador (versão + log + identidade).
 * Cada tabela usa o CABEÇALHO real da planilha de desenvolvimento (somente nomes de colunas) e dados sintéticos.
 */
import { strict as assert } from 'node:assert';
import { indexedDB } from 'fake-indexeddb';
Object.assign(globalThis, { window: { indexedDB } });
import { TABELAS_CRITICAS } from '../server/coordenacaoCritica';
const { salvarRegistroResiliente } = await import('../services/syncService');
const { salvarTabelasNoIndexedDb, carregarFilaSincronizacao, removerItemFilaConfirmado } = await import('../services/indexedDbService');
const { setMockToken } = await import('../services/googleSheetsService');
const { criarAmbiente } = await import('./ajudaAmbiente');

interface Caso { excluir?: { linha: any[]; local: Record<string, any> }; tabela: string; cab: string[]; linha: any[]; chave: string; campo: string; novo: string; local: Record<string, any> }
const casos: Caso[] = [
  { tabela: 'alunos', cab: ['aluno_id', 'nome', 'identificador_academico', 'status', 'email'], linha: ['a1', 'Estudante 1', 'RA001', 'ATIVO', ''],
    chave: 'aluno_id', campo: 'status', novo: 'INATIVO', local: { aluno_id: 'a1', nome: 'Estudante 1', identificador_academico: 'RA001', status: 'ATIVO', email: '' } },
  { tabela: 'matriculas', cab: ['matricula_id', 'aluno_id', 'turma_id', 'periodo_id', 'status', 'papel_na_turma'], linha: ['m1', 'a1', 't1', 'p1', 'MATRICULADO', 'SUPERVISAO_HORARIO_ALTERNATIVO'],
    chave: 'matricula_id', campo: 'status', novo: 'TRANCADO', local: { matricula_id: 'm1', aluno_id: 'a1', turma_id: 't1', periodo_id: 'p1', status: 'MATRICULADO', papel_na_turma: 'SUPERVISAO_HORARIO_ALTERNATIVO' } },
  { tabela: 'turmas', cab: ['turma_id', 'periodo_id', 'disciplina_id', 'nome', 'turno', 'status'], linha: ['t1', 'p1', 'd1', 'Turma 1', 'Manhã', 'ATIVA'],
    chave: 'turma_id', campo: 'turno', novo: 'Noite', local: { turma_id: 't1', periodo_id: 'p1', disciplina_id: 'd1', nome: 'Turma 1', turno: 'Manhã', status: 'ATIVA' } },
  { tabela: 'horarios_turma', cab: ['horario_id', 'turma_id', 'dia_semana', 'hora_inicio', 'hora_fim', 'data_inicio', 'data_fim', 'ativo', 'total_aulas_previstas', 'codigo_origem', 'dia_semana_rotulo'],
    linha: ['h1', 't1', 2, '08:00', '10:00', '03/08/2026', '20/12/2026', 'TRUE', 16, '', 'Terça'],
    excluir: { linha: ['h2', 't1', 4, '08:00', '10:00', '03/08/2026', '20/12/2026', 'TRUE', 16, '', 'Quinta'], local: { horario_id: 'h2', turma_id: 't1', dia_semana: 4, hora_inicio: '08:00', hora_fim: '10:00', data_inicio: '2026-08-03', data_fim: '2026-12-20', ativo: true, total_aulas_previstas: 16, codigo_origem: '', dia_semana_rotulo: 'Quinta' } },
    chave: 'horario_id', campo: 'hora_fim', novo: '10:30', local: { horario_id: 'h1', turma_id: 't1', dia_semana: 2, hora_inicio: '08:00', hora_fim: '10:00', data_inicio: '2026-08-03', data_fim: '2026-12-20', ativo: true, total_aulas_previstas: 16, codigo_origem: '', dia_semana_rotulo: 'Terça' } },
  { tabela: 'periodos', cab: ['periodo_id', 'nome', 'data_inicio', 'data_fim', 'status'], linha: ['p1', '2026.2', 46235, 46376, 'ATIVO'],
    chave: 'periodo_id', campo: 'status', novo: 'ENCERRADO', local: { periodo_id: 'p1', nome: '2026.2', data_inicio: '2026-08-03', data_fim: '2026-12-22', status: 'ATIVO' } },
  { tabela: 'disciplinas', cab: ['disciplina_id', 'codigo', 'nome', 'tipo'], linha: ['d1', 'E1A-AD', 'Clínica Adulto', 'ESTÁGIO'],
    chave: 'disciplina_id', campo: 'nome', novo: 'Clínica Adulto I', local: { disciplina_id: 'd1', codigo: 'E1A-AD', nome: 'Clínica Adulto', tipo: 'ESTÁGIO' } },
  { tabela: 'turmas_origem', cab: ['origem_id', 'turma_id', 'sistema', 'codigo_externo', 'nome_externo', 'ativo'], linha: ['o1', 't1', 'Docente Online', 'TER-M-1A', 'Clínica Adulto', 'TRUE'],
    chave: 'origem_id', campo: 'codigo_externo', novo: 'TER-M-1B', local: { origem_id: 'o1', turma_id: 't1', sistema: 'Docente Online', codigo_externo: 'TER-M-1A', nome_externo: 'Clínica Adulto', ativo: true } },
  { tabela: 'grupos_pratica', cab: ['grupo_id', 'periodo_id', 'disciplina_id', 'turma_id', 'nome_grupo', 'status', 'origem', 'origem_chave', 'criado_em', 'atualizado_em', 'campo_pratica'], linha: ['g1', 'p1', 'd1', 't1', 'Grupo A', 'ATIVO', 'CENTRAL_CONTROLE', '', '', '', ''],
    chave: 'grupo_id', campo: 'nome_grupo', novo: 'Grupo A1', local: { grupo_id: 'g1', periodo_id: 'p1', disciplina_id: 'd1', turma_id: 't1', nome_grupo: 'Grupo A', status: 'ATIVO', origem: 'CENTRAL_CONTROLE', origem_chave: '', criado_em: '', atualizado_em: '', campo_pratica: '' } },
  // O app guarda o alias `integrante_id`; a planilha tem `grupo_integrante_id` (a mesma chave).
  { tabela: 'grupo_integrantes', cab: ['grupo_integrante_id', 'grupo_id', 'matricula_id', 'data_inicio', 'data_fim', 'status', 'origem', 'origem_chave', 'atualizado_em'], linha: ['i1', 'g1', 'm1', '', '', 'ATIVO', 'CENTRAL_CONTROLE', '', ''],
    chave: 'integrante_id', campo: 'status', novo: 'INATIVO', local: { grupo_integrante_id: 'i1', integrante_id: 'i1', grupo_id: 'g1', matricula_id: 'm1', data_inicio: '', data_fim: '', status: 'ATIVO', origem: 'CENTRAL_CONTROLE', origem_chave: '', atualizado_em: '' } },
];
const alvo = process.argv[2]; // permite validar uma tabela de cada vez
// Roda para as tabelas JÁ migradas (as demais ainda usam o caminho direto até o seu passo).
const pendentes = casos.filter(x => !TABELAS_CRITICAS.has(x.tabela)).map(x => x.tabela);
if (alvo) assert(TABELAS_CRITICAS.has(alvo), `${alvo} deve passar pelo coordenador`);
for (const c of casos.filter(x => TABELAS_CRITICAS.has(x.tabela) && (!alvo || x.tabela === alvo))) {
  const amb = await criarAmbiente({ abas: { turmas:[['turma_id','periodo_id'],['t1','p1']], matriculas:[['matricula_id','aluno_id','turma_id','periodo_id'],['m1','a1','t1','p1']],grupos_pratica:[['grupo_id','turma_id'],['g1','t1']], periodos:[['periodo_id','nome','data_inicio','data_fim','status'],['p1','2027.1','2027-02-01','2027-06-30','ATIVO']], [c.tabela]: [c.cab, c.linha] } });
  setMockToken('ficticio');
  await salvarTabelasNoIndexedDb({ [c.tabela]: [c.local] });
  const idx = c.cab.indexOf(c.campo);
  const antes = c.linha.map(String);

  // 1) edição válida: grava só a coluna alterada, preserva as demais (inclusive datas em formato brasileiro) e deixa 1 linha de log
  const r = await salvarRegistroResiliente(c.tabela, 'UPDATE', { [c.chave]: c.local[c.chave], [c.campo]: c.novo });
  assert.equal(r.gravadoOnline, true, `${c.tabela}: edição válida precisa ser confirmada`);
  assert.equal(String(amb.abas[c.tabela][1][idx]), c.novo);
  c.cab.forEach((_, i) => { if (i !== idx) assert.equal(String(amb.abas[c.tabela][1][i]), antes[i], `${c.tabela}: coluna ${c.cab[i]} preservada`); });
  const log = amb.abas.log_alteracoes; assert.equal(log.length, 2, `${c.tabela}: 1 linha de log`);
  assert.equal(log[1][2], 'professora@exemplo.com'); assert.equal(log[1][3], c.tabela); assert.equal(log[1][6], c.campo);

  // 2) versão antiga (outro aparelho já mudou): conflito e valor do outro aparelho preservado
  await salvarTabelasNoIndexedDb({ [c.tabela]: [c.local] });
  await assert.rejects(() => salvarRegistroResiliente(c.tabela, 'UPDATE', { [c.chave]: c.local[c.chave], [c.campo]: 'OUTRO' }), /CONFLITO_VERSAO/);
  assert.equal(String(amb.abas[c.tabela][1][idx]), c.novo, `${c.tabela}: sem sobrescrever`);
  assert.equal(amb.abas.log_alteracoes.length, 2, 'conflito não gera log');

  // 2b) exclusão com versão atual remove só a linha certa e deixa log; com versão antiga é recusada
  if (c.excluir) {
    amb.abas[c.tabela].push([...c.excluir.linha]);
    await salvarTabelasNoIndexedDb({ [c.tabela]: [c.local, c.excluir.local] });
    const stale = { ...c.excluir.local, [c.campo]: 'ALTERADO NO OUTRO APARELHO' };
    amb.abas[c.tabela][2][idx] = 'ALTERADO NO OUTRO APARELHO';
    await assert.rejects(() => salvarRegistroResiliente(c.tabela, 'DELETE', c.excluir!.local), /CONFLITO_VERSAO/, 'exclusão com versão antiga recusada');
    assert.equal(amb.abas[c.tabela].length, 3, 'linha preservada');
    amb.abas[c.tabela][2][idx] = c.excluir.linha[idx];
    void stale;
    const fila0 = (await carregarFilaSincronizacao()).filter(i => i.tabela === c.tabela && i.payload[c.chave] === c.excluir!.local[c.chave]);
    for (const i of fila0) await removerItemFilaConfirmado(i.id);
    await salvarTabelasNoIndexedDb({ [c.tabela]: [c.local, c.excluir.local] }); // volta a versão atual ao aparelho
    if (process.env.DEBUG_AMBIENTE) console.log('[linha h2 antes]', JSON.stringify(amb.abas[c.tabela][2]), JSON.stringify(amb.abas[c.tabela].map(r => r[0])));
    const del = await salvarRegistroResiliente(c.tabela, 'DELETE', c.excluir.local);
    assert.equal(del.gravadoOnline, true); assert.equal(amb.abas[c.tabela].length, 2, 'linha removida');
    assert.equal(String(amb.abas[c.tabela][1][0]), c.local[c.chave], 'a outra linha permanece');
    assert.equal(amb.abas.log_alteracoes.at(-1)![5], 'DELETE');
    await salvarTabelasNoIndexedDb({ [c.tabela]: [c.local] });
  }

  // 3) conta fora da lista não grava e não "salva"
  const fila = (await carregarFilaSincronizacao()).filter(i => i.tabela === c.tabela && i.status === 'CONFLITO');
  assert.equal(fila.length, 1, 'conflito fica preservado para revisão');
  amb.restaurar();
  console.log(`  migração ${c.tabela}: versão, log, preservação de colunas e conflito validados`);
}
console.log('Migração de cadastro: validada por tabela. Ainda no caminho direto:', pendentes.join(', ') || 'nenhuma');
