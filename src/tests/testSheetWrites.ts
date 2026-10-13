/**
 * Leitura e gravação na planilha usando uma planilha simulada com o FORMATO REAL da base
 * (dia da semana por extenso, datas como número de série, colunas calculadas por fórmula).
 * Nenhum dado real, token real ou planilha da instituição é usado.
 */
import { strict as assert } from 'node:assert';
import {
  setMockToken,
  clearAccessToken,
  gravarRegistroNaPlanilhaOficial,
  gravarLoteNaPlanilhaOficial,
  removerRegistroDaPlanilhaOficial,
  carregarDadosDaPlanilhaOficial,
} from '../services/googleSheetsService';
import { normalizarLinhasDaAba, normalizarDiaSemana, normalizarHora } from '../services/normalizacaoPlanilha';
import { criarPlanilhaFalsa } from './planilhaFalsa';

const originalFetch = globalThis.fetch;
const SERIAL_11_AGO_2026 = 46245; // 11/08/2026
const SERIAL_29_SET_2026 = 46294; // 29/09/2026

const base = () => criarPlanilhaFalsa({
  // A planilha guardou "2026.2" como data (46054); o texto exibido continua "2026.2".
  periodos: [['periodo_id', 'nome', 'data_inicio', 'data_fim', 'status'], ['p1', 46054, 46235, 46376, 'ATIVO']],
  disciplinas: [['disciplina_id', 'codigo', 'nome', 'tipo'], ['d1', 'E1A-AD', 'Clínica Adulto', 'ESTÁGIO']],
  turmas: [['turma_id', 'periodo_id', 'disciplina_id', 'nome', 'turno', 'status'], ['t1', 'p1', 'd1', 'Clínica Adulto', 'MATUTINO', 'ATIVO']],
  alunos: [['aluno_id', 'nome', 'identificador_academico', 'status', 'email'], ['a1', 'Aluna Teste', '', 'ATIVO', 'a@exemplo.com']],
  matriculas: [['matricula_id', 'aluno_id', 'turma_id', 'periodo_id', 'status', 'papel_na_turma'], ['m1', 'a1', 't1', 'p1', 'MATRICULADO', '']],
  horarios_turma: [
    ['horario_id', 'turma_id', 'dia_semana', 'hora_inicio', 'hora_fim', 'data_inicio', 'data_fim', 'ativo'],
    ['h1', 't1', 'TERCA', '08:20', '11:00', SERIAL_11_AGO_2026, 46357, 'TRUE'],
  ],
  orientacoes: [['orientacao_id', 'matricula_id', 'data_hora', 'categoria', 'texto', 'status']],
  frequencias: [['frequencia_id', 'matricula_id', 'data_aula', 'status', 'justificativa', 'origem_id', 'criado_em', 'atualizado_em']],
  entregas: [
    ['entrega_id', 'periodo_id', 'turma_id', 'matricula_id', 'codigo_entrega', 'tipo_entrega', 'escopo', 'prazo', 'data_envio', 'status'],
    ['e1', 'p1', 't1', 'm1', 'TERMO_COMPROMISSO', 'TERMO_COMPROMISSO', 'INDIVIDUAL', '', '', 'A conferir'],
  ],
  leituras_responsaveis: [
    ['leitura_agenda_id', 'periodo_id', 'turma_id', 'codigo_origem', 'data_discussao', 'tipo', 'titulo', 'responsaveis_texto', 'responsavel_tipo', 'status_temporal', 'fonte', 'observacao', 'status_realizacao', 'responsaveis_efetivos', 'motivo_substituicao'],
    ['LEIT-1', 'p1', 't1', 'TER-M-1A', SERIAL_29_SET_2026, 'ESTUDO_DIRIGIDO', 'Psicoterapia breve', 'Aluna Teste', 'ALUNO', '=IF(E2<TODAY(),"CONCLUIDO","FUTURO")', 'Guia', '', '', '', ''],
  ],
  registros_semanais: [['registro_id', 'matricula_id', 'semana_rss'], ['=VSTACK(...)', '', '']],
  marcos_academicos: [['marco_id', 'nome', 'data_prazo', 'status'], ['MARCO-1', 'Fim', 46376, '=IF(C2<TODAY(),"CONCLUIDO","PENDENTE")']],
}, {
  periodos: [['periodo_id', 'nome', 'data_inicio', 'data_fim', 'status'], ['p1', '2026.2', '01/08/2026', '20/12/2026', 'ATIVO']],
  avaliacoes: [['avaliacao_id', 'nota'], ['av1', '1,5']],
});

try {
  setMockToken('token-ficticio-testes');

  // 1. Formato real: dia da semana por extenso, datas em número de série e "TRUE" em texto.
  assert.equal(normalizarDiaSemana('TERCA'), 2);
  assert.equal(normalizarDiaSemana('Quinta-feira'), 4);
  assert.equal(normalizarDiaSemana('6'), 6);
  assert.equal(normalizarHora('8:20:00'), '08:20');
  assert.equal(normalizarHora(0.5), '12:00');
  {
    const p = base();
    globalThis.fetch = p.fetchFalso;
    const { tabelas, ausentes } = await carregarDadosDaPlanilhaOficial();
    const h = tabelas.horarios_turma[0];
    assert.equal(h.dia_semana, 2, 'TERCA deve virar 2 (terça)');
    assert.equal(h.data_inicio, '2026-08-11', 'data de série vira AAAA-MM-DD');
    assert.equal(h.ativo, true);
    assert.equal(tabelas.periodos[0].data_inicio, '2026-08-01');
    assert.equal(tabelas.periodos[0].nome, '2026.2', 'texto que a planilha converteu em data volta a ser o texto exibido');
    const leitura = tabelas.leituras_responsaveis[0];
    assert.equal(leitura.data, '2026-09-29');
    assert.equal(leitura.tema, 'Psicoterapia breve');
    assert.equal(leitura.responsavel_nome, 'Aluna Teste');
    assert.equal(leitura.leitura_id, 'LEIT-1');
    assert.equal(tabelas.entregas[0].situacao, 'A_CONFERIR');
    assert.equal(tabelas.entregas[0].tipo_documento, 'TERMO_COMPROMISSO');
    assert(ausentes.includes('tarefas_professora'), 'aba ainda não criada é informada como ausente');
    const lotes = p.chamadas.filter(c => c.url.includes('values:batchGet'));
    assert.equal(lotes.length, 2, 'uma leitura bruta de todas as abas + uma leitura do texto exibido das abas de cadastro');
    assert(!lotes[1].url.includes('registros_semanais'), 'abas grandes não são lidas duas vezes');
    assert(p.chamadas.some(c => c.url.includes('valueRenderOption=UNFORMATTED_VALUE')), 'lê valores brutos');
  }

  // 2. INSERT não interpreta texto com "=" como fórmula e usa :append com RAW.
  {
    const p = base();
    globalThis.fetch = p.fetchFalso;
    await gravarRegistroNaPlanilhaOficial('orientacoes', {
      orientacao_id: 'ori-1', matricula_id: 'm1', data_hora: '2026-10-13T08:30:00', categoria: 'Clínica', texto: '=2+2', status: 'ABERTA',
    });
    const append = p.chamadas.find(c => c.method === 'POST' && c.url.includes(':append?'));
    assert(append?.url.includes('valueInputOption=RAW'), 'RAW é obrigatório para texto livre');
    assert.equal(p.linhas('orientacoes')[1][4], '=2+2');
  }

  // 3. UPDATE grava SOMENTE as células alteradas: a coluna calculada por fórmula fica intacta.
  {
    const p = base();
    globalThis.fetch = p.fetchFalso;
    const [leitura] = (await carregarDadosDaPlanilhaOficial()).tabelas.leituras_responsaveis;
    await gravarRegistroNaPlanilhaOficial('leituras_responsaveis', {
      ...leitura, status_realizacao: 'SUBSTITUICAO', responsaveis_efetivos: ['m1'], motivo_substituicao: 'Atestado', status_temporal: 'X',
    });
    const linha = p.linhas('leituras_responsaveis')[1];
    assert.equal(linha[9], '=IF(E2<TODAY(),"CONCLUIDO","FUTURO")', 'fórmula da coluna J preservada');
    assert.equal(linha[4], SERIAL_29_SET_2026, 'data original preservada como data (não virou texto)');
    assert.deepEqual(linha.slice(12, 15), ['SUBSTITUICAO', 'm1', 'Atestado']);
    const escrita = p.chamadas.find(c => c.url.includes('values:batchUpdate'))!;
    assert.deepEqual(escrita.body.data.map((d: any) => d.range), ["'leituras_responsaveis'!M2", "'leituras_responsaveis'!N2", "'leituras_responsaveis'!O2"]);
  }

  // 4. Atualização parcial preserva campos não informados.
  {
    const p = base();
    p.linhas('orientacoes').push(['ori-1', 'm1', 46298.48, 'Clínica', 'Orientação preservada', 'ABERTA']);
    globalThis.fetch = p.fetchFalso;
    await gravarRegistroNaPlanilhaOficial('orientacoes', { orientacao_id: 'ori-1', status: 'CONCLUÍDA' });
    assert.deepEqual(p.linhas('orientacoes')[1], ['ori-1', 'm1', 46298.48, 'Clínica', 'Orientação preservada', 'CONCLUÍDA']);
  }

  // 5. Entregas: só o status pode mudar; tipo/alias respeitam o schema oficial.
  {
    const p = base();
    globalThis.fetch = p.fetchFalso;
    const [entrega] = (await carregarDadosDaPlanilhaOficial()).tabelas.entregas;
    await gravarRegistroNaPlanilhaOficial('entregas', { ...entrega, status: 'Entregue', turma_id: 'OUTRA' }, ['status', 'turma_id']);
    const linha = p.linhas('entregas')[1];
    assert.equal(linha[9], 'Entregue');
    assert.equal(linha[2], 't1', 'campo fora da lista de editáveis não é alterado');
    await gravarRegistroNaPlanilhaOficial('entregas', {
      entrega_id: 'e2', periodo_id: 'p1', turma_id: 't1', matricula_id: 'm1', tipo_documento: 'MANUAL_ESTAGIO', status: 'Pendente',
    });
    assert.equal(p.linhas('entregas')[2][5], 'MANUAL_ESTAGIO');
  }

  // 6. Chamada em lote: 1 leitura + 1 append para a turma inteira; repetir não duplica;
  //    colunas novas (atraso/celular) são acrescentadas ao fim do cabeçalho.
  {
    const p = base();
    globalThis.fetch = p.fetchFalso;
    const chamada = Array.from({ length: 20 }, (_, i) => ({
      registro: { frequencia_id: `f${i}`, matricula_id: `m${i}`, data_aula: '2026-10-13', status: 'PRESENTE', atraso: i === 3, celular: false },
    }));
    await gravarLoteNaPlanilhaOficial('frequencias', chamada);
    const leituras = p.chamadas.filter(c => c.method === 'GET' && c.url.includes("/values/'frequencias'"));
    const appends = p.chamadas.filter(c => c.url.includes(':append?'));
    assert.equal(leituras.length, 1, 'uma leitura para o lote inteiro');
    assert.equal(appends.length, 1, 'um append para o lote inteiro');
    assert.equal(p.linhas('frequencias').length, 21);
    assert.deepEqual(p.linhas('frequencias')[0].slice(8), ['atraso', 'celular']);
    assert.equal(p.linhas('frequencias')[4][8], 'TRUE');

    p.chamadas.length = 0;
    await gravarRegistroNaPlanilhaOficial('frequencias', {
      frequencia_id: 'outro-id', matricula_id: 'm1', data_aula: '2026-10-13', status: 'FALTA_JUSTIFICADA', justificativa: 'Atestado',
    });
    assert.equal(p.linhas('frequencias').length, 21, 'mesma matrícula/data não duplica');
    assert.equal(p.linhas('frequencias')[2][3], 'FALTA_JUSTIFICADA');
    assert.equal(p.linhas('frequencias')[2][0], 'f1', 'id original preservado');
  }

  // 7. Abas geradas por fórmula são somente leitura.
  {
    const p = base();
    globalThis.fetch = p.fetchFalso;
    await assert.rejects(() => gravarRegistroNaPlanilhaOficial('registros_semanais', { registro_id: 'r1' }), /somente leitura/);
    await assert.rejects(() => gravarRegistroNaPlanilhaOficial('marcos_academicos', { marco_id: 'MARCO-1', status: 'X' }), /somente leitura/);
    await assert.rejects(() => gravarRegistroNaPlanilhaOficial('leituras_responsaveis', { leitura_agenda_id: 'NOVA', titulo: 'x' }), /não cria linhas/);
    assert(!p.chamadas.some(c => c.method === 'POST'), 'nenhuma escrita enviada');
  }

  // 8. Aba do app inexistente é criada com cabeçalho padrão na primeira gravação.
  {
    const p = base();
    globalThis.fetch = p.fetchFalso;
    await gravarRegistroNaPlanilhaOficial('tarefas_professora', {
      id: 'tf1', titulo: 'Conferir termos', prioridade: 'ALTA', duracao_minutos: 5, status: 'PENDENTE', criado_em: '2026-10-13',
    });
    const linhas = p.linhas('tarefas_professora');
    assert.equal(linhas[0][0], 'tarefa_id');
    assert.equal(linhas[1][0], 'tf1');
    assert.equal(linhas[1][1], 'Conferir termos');
  }

  // 9. Exclusão: uma linha identificada; duplicidade bloqueia; já excluída conta como concluída.
  {
    const p = base();
    p.linhas('orientacoes').push(['ori-1', 'm1'], ['ori-2', 'm1'], ['ori-2', 'm2']);
    globalThis.fetch = p.fetchFalso;
    await removerRegistroDaPlanilhaOficial('orientacoes', { orientacao_id: 'ori-1' });
    assert.equal(p.linhas('orientacoes').length, 3);
    await assert.rejects(() => removerRegistroDaPlanilhaOficial('orientacoes', { orientacao_id: 'ori-2' }), /duplicada/);
    await removerRegistroDaPlanilhaOficial('orientacoes', { orientacao_id: 'ja-excluida' });
    assert.equal(p.linhas('orientacoes').length, 3);
  }

  // 10. Registro incompatível com o cabeçalho e chave duplicada bloqueiam a escrita.
  {
    const p = base();
    p.linhas('orientacoes').push(['ori-1', 'm1'], ['ori-1', 'm2']);
    globalThis.fetch = p.fetchFalso;
    await assert.rejects(() => gravarRegistroNaPlanilhaOficial('entregas', { entrega_id: 'x', codigo_inexistente: 'x' }), /incompatível/);
    await assert.rejects(() => gravarRegistroNaPlanilhaOficial('orientacoes', { orientacao_id: 'ori-1', texto: 'c' }), /duplicada/);
    assert(!p.chamadas.some(c => c.method === 'POST'));
  }

  // 11. Normalização é idempotente (pode rodar sobre cache antigo).
  const duas = normalizarLinhasDaAba('horarios_turma', normalizarLinhasDaAba('horarios_turma', [{ dia_semana: 'QUINTA', ativo: true }]));
  assert.equal(duas[0].dia_semana, 4);

  console.log('[PASS] 11 grupos de testes de leitura/gravação com o formato real da planilha.');
} finally {
  globalThis.fetch = originalFetch;
  clearAccessToken();
}
