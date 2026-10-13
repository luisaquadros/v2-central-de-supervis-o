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

  // 12. Formato atual da planilha (correção C1): dia em número + rótulo. O app grava NÚMERO, não texto,
  //     e mantém o rótulo coerente; números (notas, totais) também seguem como número.
  {
    const p = base();
    const h = p.linhas('horarios_turma');
    h[0].push('dia_semana_rotulo');
    h[1][2] = 2;
    h[1].push('TERCA');
    globalThis.fetch = p.fetchFalso;
    const { tabelas } = await carregarDadosDaPlanilhaOficial();
    assert.equal(tabelas.horarios_turma[0].dia_semana, 2);
    await gravarLoteNaPlanilhaOficial('horarios_turma', [{ registro: { ...tabelas.horarios_turma[0], dia_semana: 4 }, campos: ['dia_semana'] }]);
    const linha = p.linhas('horarios_turma')[1];
    assert.strictEqual(linha[2], 4, 'dia_semana deve ser gravado como número');
    assert.equal(linha[8], 'QUINTA', 'rótulo acompanha o número');
    assert.equal(linha[3], '08:20', 'demais colunas intactas');
  }

  // 13. Importações do caderno: feedback usa a data do registro (não a da importação);
  //     ocorrência com data em texto livre é ordenável e mantém o texto original.
  {
    const fbs = normalizarLinhasDaAba('feedbacks', [
      { feedback_id: 'f1', data: '03/09/2026', criado_em: '2026-10-13' },
      { feedback_id: 'f2', data: '2026-10-13', criado_em: '2026-10-13T09:15:00' },
      { feedback_id: 'f3', data: 'Set/2026', criado_em: '2026-10-13' },
      { feedback_id: 'f4', data: 'Início do semestre', criado_em: '2026-10-13' },
      { feedback_id: 'f5', data: '17–19/09/2026', criado_em: '2026-10-13' },
    ]);
    assert.equal(fbs[0].data_hora, '2026-09-03');
    assert.equal(fbs[1].data_hora, '2026-10-13T09:15:00');
    assert.deepEqual([fbs[2].data_hora, fbs[2].data_texto], ['2026-09-01', 'Set/2026']);
    assert.deepEqual([fbs[3].data_hora, fbs[3].data_texto], ['', 'Início do semestre'], 'sem data: não usa o dia da importação');
    assert.deepEqual([fbs[4].data_hora, fbs[4].data_texto], ['2026-09-19', '17–19/09/2026']);
    assert.deepEqual(normalizarLinhasDaAba('feedbacks', fbs), fbs, 'normalização idempotente');
    const oc = normalizarLinhasDaAba('ocorrencias', [
      { ocorrencia_id: 'o1', data_hora: '29/09 e 05/10/2026' },
      { ocorrencia_id: 'o2', data_hora: '05/10/2026' },
      { ocorrencia_id: 'o3', data_hora: '2026-10-13T12:00:00.000Z' },
      { ocorrencia_id: 'o4', data_hora: 'sem data' },
    ]);
    assert.equal(oc[0].data_hora, '2026-10-05');
    assert.equal(oc[0].data_texto, '29/09 e 05/10/2026');
    assert.equal(oc[1].data_hora, '2026-10-05');
    assert.equal(oc[1].data_texto, undefined);
    assert.match(oc[2].data_hora, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 'carimbo vira hora local, sem Z');
    assert.deepEqual([oc[3].data_hora, oc[3].data_texto], ['', 'sem data']);
    assert.deepEqual(normalizarLinhasDaAba('ocorrencias', oc), oc, 'normalização idempotente');
  }

  // 14. Carimbo antigo em UTC passa a hora local (no Brasil, 01h30Z de 14/10 = 22h30 de 13/10).
  {
    const [o] = normalizarLinhasDaAba('orientacoes', [{ orientacao_id: 'o1', data_hora: '2026-10-14T01:30:00.000Z' }]);
    const esperado = new Date('2026-10-14T01:30:00.000Z');
    const p2 = (n: number) => String(n).padStart(2, '0');
    assert.equal(o.data_hora, `${esperado.getFullYear()}-${p2(esperado.getMonth() + 1)}-${p2(esperado.getDate())}T${p2(esperado.getHours())}:30:00`);
    assert.deepEqual(normalizarLinhasDaAba('orientacoes', [o]), [o]);
  }

  console.log('[PASS] 14 grupos de testes de leitura/gravação com o formato real da planilha.');
} finally {
  globalThis.fetch = originalFetch;
  clearAccessToken();
}
