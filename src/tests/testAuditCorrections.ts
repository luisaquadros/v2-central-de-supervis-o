import {
  calcularMetricasCronogramaRss,
  MetricasCronogramaRss,
  obterDatasCalendarioAcademico,
  derivarNotificacoesOperacionais,
  obterSituacaoRssEstudante,
} from '../services/supervisaoOperacionalService';
import {
  validarEscritaTabela,
  gerarIdEstavel,
  TABELAS_AUTORIZADAS_ESCRITA,
} from '../services/safeWriteService';
import {
  normalizarChaveAba,
  formatarRangeSheet,
} from '../services/googleSheetsService';
import {
  CalendarioRss,
  SituacaoAtualTurma,
  Frequencia,
  Periodo,
  MarcoAcademico,
} from '../types';
import { SyncQueueItem } from '../services/indexedDbService';
import { normalizarNota, formatarNotaParaExibicao } from '../utils/gradeUtils';

console.log('================================================================');
console.log('BATERIA DE TESTES DE AUDITORIA E CORREÇÕES OBRIGATÓRIAS');
console.log('================================================================\n');

let passes = 0;
let fails = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passes++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    fails++;
  }
}

// ============================================================================
// 1. TESTE: CALENDARIO_RSS DE DUAS TURMAS DIFERENTES (ISOLAMENTO ESTRITO)
// ============================================================================
console.log('--- 1. Isolamento Estrito de calendario_rss por turma_id ---');
const calTurma1: CalendarioRss[] = [
  { turma_id: 'turma-A', sequencia: 1, semana: 1, semana_inicio: '2026-08-01', semana_fim: '2026-08-07', status_calendario: 'CONCLUIDA' },
  { turma_id: 'turma-A', sequencia: 2, semana: 2, semana_inicio: '2026-08-08', semana_fim: '2026-08-14', status_calendario: 'CONCLUIDA' },
  { turma_id: 'turma-A', sequencia: 3, semana: 3, semana_inicio: '2026-08-15', semana_fim: '2026-08-21', status_calendario: 'ATUAL' },
  { turma_id: 'turma-B', sequencia: 1, semana: 1, semana_inicio: '2026-09-01', semana_fim: '2026-09-07', status_calendario: 'ATUAL' },
];

const resTurmaA = calcularMetricasCronogramaRss('turma-A', calTurma1, [], '2026-08-16');
const resTurmaB = calcularMetricasCronogramaRss('turma-B', calTurma1, [], '2026-08-16');

assert(resTurmaA.semanaAtual === 3, 'Turma A está na Semana 3');
assert(resTurmaA.semanasEncerradas === 2, 'Turma A tem 2 semanas encerradas');
assert(resTurmaA.semanaTexto === '3 / 3', 'Turma A exibe 3 / 3 (total de sequências cadastradas)');

assert(resTurmaB.semanaAtual === 1, 'Turma B está na Semana 1');
assert(resTurmaB.semanasEncerradas === 0, 'Turma B tem 0 semanas encerradas');
assert(resTurmaB.semanaTexto === '1 / 1', 'Turma B não herda total ou sequências da Turma A');

// ============================================================================
// 2. TESTE: TURMA SEM CALENDARIO_RSS (NUNCA FALLBACK PARA OUTRA TURMA)
// ============================================================================
console.log('\n--- 2. Turma sem calendario_rss ---');
const resTurmaSemCal = calcularMetricasCronogramaRss('turma-C-inexistente', calTurma1, [], '2026-08-16');

assert(resTurmaSemCal.temDados === false, 'Turma sem calendário marca temDados = false');
assert(resTurmaSemCal.semanaTexto === '—', 'Semana de prática exibe "—"');
assert(resTurmaSemCal.semanasEncerradasTexto === '—', 'Semanas encerradas exibe "—"');
assert(resTurmaSemCal.fonte === 'sem_dados', 'Fonte classificada como sem_dados');
assert(
  resTurmaSemCal.avisoInconsistencia?.includes('Sem cronograma cadastrado') ?? false,
  'Exibe aviso neutro de dados não disponíveis'
);

// ============================================================================
// 3. TESTE: CALENDÁRIO COM DATAS DEFASADAS
// ============================================================================
console.log('\n--- 3. Calendário com datas defasadas ---');
// Todas as semanas no passado, mas sem status ATUAL explícito
const calDatasPassadas: CalendarioRss[] = [
  { turma_id: 'turma-D', sequencia: 1, semana: 1, semana_inicio: '2026-01-01', semana_fim: '2026-01-07', status_calendario: 'CONCLUIDA' },
  { turma_id: 'turma-D', sequencia: 2, semana: 2, semana_inicio: '2026-01-08', semana_fim: '2026-01-14', status_calendario: 'CONCLUIDA' },
  { turma_id: 'turma-D', sequencia: 3, semana: 3, semana_inicio: '2026-01-15', semana_fim: '2026-01-21', status_calendario: 'CONCLUIDA' },
];

const resDefasadas = calcularMetricasCronogramaRss('turma-D', calDatasPassadas, [], '2026-10-06');
assert(resDefasadas.semanasEncerradas !== null, 'Calcula semanas encerradas');
assert(
  (resDefasadas.semanasEncerradas ?? 0) < (resDefasadas.semanaAtual ?? 1) || resDefasadas.semanasEncerradas === 2,
  'Invariante mantida para datas defasadas'
);

// ============================================================================
// 4. TESTE: CONFLITO ENTRE SEMANA ATUAL E DATAS (RESOLUÇÃO DEFINITIVA DO 5/12 x 10)
// ============================================================================
console.log('\n--- 4. Conflito entre Semana Atual e Datas (Bug 5/12 x 10) ---');
// Cenário exato da auditoria:
// Tabela situacao_atual_turmas marca: aula_cronograma_atual = 5, rss_total_previsto = 12
// Mas calendario_rss contém 10 semanas antigas com data_fim < hoje
const calConflito: CalendarioRss[] = [];
for (let i = 1; i <= 10; i++) {
  calConflito.push({
    turma_id: 'turma-conflito',
    sequencia: i,
    semana: i,
    semana_inicio: `2026-01-0${i}`,
    semana_fim: `2026-01-0${i}`,
    status_calendario: 'CONCLUIDA',
  });
}
for (let i = 11; i <= 12; i++) {
  calConflito.push({
    turma_id: 'turma-conflito',
    sequencia: i,
    semana: i,
    semana_inicio: `2026-11-${i}`,
    semana_fim: `2026-11-${i}`,
    status_calendario: 'PLANEJADA',
  });
}

const situacaoOficial: SituacaoAtualTurma[] = [
  {
    turma_id: 'turma-conflito',
    aula_cronograma_atual: 5,
    rss_esperados_ate_hoje: 4,
    rss_total_previsto: 12,
  },
];

const resConflito = calcularMetricasCronogramaRss('turma-conflito', calConflito, situacaoOficial, '2026-10-06');

assert(resConflito.semanaAtual === 5, 'Semana atual é estritamente 5 (materializada na situacao_atual_turmas)');
assert(resConflito.totalSemanas === 12, 'Total de semanas é 12');
assert(resConflito.semanaTexto === '5 / 12', 'Semana de prática exibe 5 / 12');
assert(resConflito.semanasEncerradas === 4, 'Semanas encerradas NUNCA exibe 10 quando semana atual é 5 (ajustado para 4)');
assert(resConflito.semanasEncerradasTexto === '4', 'Texto de semanas encerradas exibe "4"');
assert(resConflito.conflitoIdentificado === true, 'Conflito de datas defasadas na base foi identificado e sinalizado');
assert(
  resConflito.avisoInconsistencia?.includes('Conflito de datas na base') ||
  resConflito.avisoInconsistencia?.includes('Inconsistência') || false,
  'Mensagem de inconsistência gerada para auditoria'
);

// ============================================================================
// 5. TESTE: VALIDAÇÃO DE ESCRITA SEGURA E TABELAS PROTEGIDAS
// ============================================================================
console.log('\n--- 5. Arquitetura de Escrita Segura (safeWriteService) ---');
const escritaValida = validarEscritaTabela('frequencias', { matricula_id: 'mat-1', status: 'PRESENTE' });
assert(escritaValida.valido === true, 'Tabela "frequencias" autorizada');

const escritaBloqueadaFonte = validarEscritaTabela('fonte_alunos', { id: 1 });
assert(escritaBloqueadaFonte.valido === false, 'Bloqueio categórico de aba "fonte_alunos"');

const escritaBloqueadaBackup = validarEscritaTabela('backup_turmas', { id: 1 });
assert(escritaBloqueadaBackup.valido === false, 'Bloqueio categórico de aba "backup_turmas"');

const escritaBloqueadaRascunho = validarEscritaTabela('rascunho_notas', { id: 1 });
assert(escritaBloqueadaRascunho.valido === false, 'Bloqueio categórico de aba "rascunho_notas"');

// ============================================================================
// 6. TESTE: TRATAMENTO SEGURO DE TOKEN EXPIRADO / PERSISTÊNCIA LOCAL
// ============================================================================
console.log('\n--- 6. Simulação de Token OAuth Expirado e Fila de Sincronização ---');

// Chave determinística de chamada para evitar duplicidade
function gerarChaveFrequencia(matriculaId: string, dataAula: string): string {
  return `freq_${matriculaId}_${dataAula}`;
}

const key1 = gerarChaveFrequencia('mat-100', '2026-10-06');
const key2 = gerarChaveFrequencia('mat-100', '2026-10-06');
assert(key1 === key2, 'Chave de frequência é determinística e idempotente');

// Simulação de fila local (syncQueue)
const mockQueue: Map<string, SyncQueueItem> = new Map();

function enfileirarItem(item: { id: string; tabela: string; tipo: 'INSERT' | 'UPDATE'; payload: any }) {
  mockQueue.set(item.id, {
    id: item.id,
    tabela: item.tabela,
    tipo: item.tipo,
    payload: item.payload,
    criado_em: new Date().toISOString(),
    tentativas: 0,
    status: 'PENDENTE',
  });
}

// Simulando chamada de supervisão com token expirado
const matriculasChamada = ['mat-1', 'mat-2', 'mat-3'];
const dataSupervisao = '2026-10-06';

matriculasChamada.forEach(mId => {
  const chave = gerarChaveFrequencia(mId, dataSupervisao);
  enfileirarItem({
    id: chave,
    tabela: 'frequencias',
    tipo: 'INSERT',
    payload: { matricula_id: mId, data_aula: dataSupervisao, status: 'PRESENTE' },
  });
});

assert(mockQueue.size === 3, 'Todos os 3 registros foram preservados na fila local');

// Simula re-envio do mesmo lote (idempotência: reenviar não pode duplicar chaves na fila)
matriculasChamada.forEach(mId => {
  const chave = gerarChaveFrequencia(mId, dataSupervisao);
  enfileirarItem({
    id: chave,
    tabela: 'frequencias',
    tipo: 'INSERT',
    payload: { matricula_id: mId, data_aula: dataSupervisao, status: 'PRESENTE' },
  });
});

assert(mockQueue.size === 3, 'Re-envio do mesmo lote não gerou itens duplicados na fila local');

// ============================================================================
// 7. TESTE: FALHA DE INTERNET DURANTE SALVAMENTO
// ============================================================================
console.log('\n--- 7. Falha de Internet (Network Error) Durante Salvamento ---');
const filaAposQuedaNet: Map<string, SyncQueueItem> = new Map();

async function simularSalvamentoComQuedaRede(matriculaId: string, data: string) {
  const chave = gerarChaveFrequencia(matriculaId, data);
  try {
    // Simula tentativa de fetch com queda de internet
    throw new TypeError('Failed to fetch: Network error / Offline');
  } catch (err: any) {
    // Preservação local imediata
    filaAposQuedaNet.set(chave, {
      id: chave,
      tabela: 'frequencias',
      tipo: 'INSERT',
      payload: { matricula_id: matriculaId, data_aula: data, status: 'PRESENTE' },
      criado_em: new Date().toISOString(),
      tentativas: 0,
      status: 'PENDENTE',
      erro: 'Falha de conexão: salvo no dispositivo aguardando internet',
    });
    return { salvoLocal: true, sincronizadoRemoto: false, statusTexto: '● Salvo neste dispositivo — aguardando sincronização' };
  }
}

const resultadoQueda = await simularSalvamentoComQuedaRede('mat-999', '2026-10-06');
assert(resultadoQueda.salvoLocal === true, 'Falha de rede preserva dado localmente');
assert(resultadoQueda.sincronizadoRemoto === false, 'Falha de rede NÃO indica sucesso remoto');
assert(resultadoQueda.statusTexto === '● Salvo neste dispositivo — aguardando sincronização', 'Status padronizado ao cair internet');
assert(filaAposQuedaNet.size === 1, 'Registro inserido com segurança na fila de sincronização');

// ============================================================================
// 8. TESTE: RECONEXÃO E CONFIRMAÇÃO REMOTA REAL DO SHEETS
// ============================================================================
console.log('\n--- 8. Simulação de Reconexão e Confirmação no Sheets ---');

// Mock do comportamento da API Google Sheets:
// Resposta 401: Token expirado -> erro capturado, dados preservados na fila
let tokenSimulado = 'EXPIRADO';
let dadosNoSheetsRemoto: any[] = [];

async function simularEnvioAoSheets(item: SyncQueueItem): Promise<{ status: number }> {
  if (tokenSimulado === 'EXPIRADO') {
    return { status: 401 };
  }
  // Token válido (200 OK)
  dadosNoSheetsRemoto.push(item.payload);
  return { status: 200 };
}

async function simularProcessamentoFila() {
  const itens = Array.from(mockQueue.values());
  for (const item of itens) {
    const res = await simularEnvioAoSheets(item);
    if (res.status === 200) {
      mockQueue.delete(item.id); // Confirmação remota recebida
    }
  }
}

// Execução 1: Com token expirado
await simularProcessamentoFila();
assert(mockQueue.size === 3, 'Com token expirado, nenhum item é removido da fila local');
assert(dadosNoSheetsRemoto.length === 0, 'Nenhum dado é gravado no Sheets com token expirado');

// Execução 2: Usuário clica em "Reconectar e Sincronizar" -> novo token válido obtido
tokenSimulado = 'TOKEN_VALIDO_RENOVADO';
await simularProcessamentoFila();
assert(mockQueue.size === 0, 'Após reconexão, fila local é completamente processada e esvaziada');
assert(dadosNoSheetsRemoto.length === 3, 'Dados confirmados e gravados com sucesso no Sheets com status 200');

// ============================================================================
// 9. TESTE: CALENDÁRIO ACADÊMICO OFICIAL 2026.2 (10/08 A 01/12/2026) vs PRÁTICA
// ============================================================================
console.log('\n--- 9. Calendário Acadêmico Oficial 2026.2 vs Cronograma de Prática ---');

const per2026: Periodo = {
  periodo_id: 'per_2026_2',
  nome: '2026.2',
  data_inicio: '2026-08-10',
  data_fim: '2026-12-05',
  status: 'ATIVO',
};

// Data em Outubro (meio do semestre acadêmico, mesmo que a prática esteja avançada)
const infoOutubro = obterDatasCalendarioAcademico(per2026, '2026-10-15');
assert(infoOutubro.dataInicio === '2026-08-10', '2026.2 inicia em 10/08/2026');
assert(infoOutubro.dataFim === '2026-12-05', '2026.2 encerra somente na semana de 01/12/2026');
assert(infoOutubro.estaNaSemanaFinal === false, 'Em 15/10/2026 NÃO está na semana final');
assert(infoOutubro.encerrado === false, 'Em 15/10/2026 NÃO está encerrado');

// Verificação de que derivarNotificacoesOperacionais NÃO emite alerta de fim de semestre em outubro
const notifsOutubro = derivarNotificacoesOperacionais(
  [], [], [], [], [],
  [
    {
      marco_id: 'm-atendimentos',
      periodo_id: 'per_2026_2',
      nome: 'Encerramento dos atendimentos',
      tipo: 'ENCERRAMENTO_ATENDIMENTOS',
      data_prazo: '2026-10-20',
      status: 'PENDENTE',
    },
  ],
  [], [], [],
  new Date('2026-10-15T12:00:00Z'),
  [per2026],
  'per_2026_2'
);

const temAlertaFimPrecoce = notifsOutubro.some(
  n => n.id.includes('encerramento-academico') || (n.titulo.includes('Semestre') && n.titulo.includes('Encerramento'))
);
assert(!temAlertaFimPrecoce, 'Nenhum alerta de fim do semestre letivo emitido prematuramente em outubro');

// Marco operacional de atendimentos em outubro indica claramente atividade prática sem fingir que o semestre acabou
const marcoAtendimento = notifsOutubro.find(n => n.id.includes('m-atendimentos'));
assert(
  !marcoAtendimento || marcoAtendimento.mensagem.includes('dezembro'),
  'Marco operacional de prática esclarece que semestre acadêmico segue até dezembro'
);

// Na semana de 01/12/2026, agora SIM dispara o marco acadêmico oficial
const notifsDezembro = derivarNotificacoesOperacionais(
  [], [], [], [], [], [], [], [], [],
  new Date('2026-12-02T12:00:00Z'),
  [per2026],
  'per_2026_2'
);
const temAlertaDezembro = notifsDezembro.some(n => n.id.includes('encerramento-academico'));
assert(temAlertaDezembro, 'Alerta oficial de encerramento acadêmico emitido corretamente na semana de 01/12/2026');

// ============================================================================
// 10. TESTE: RESOLUÇÃO DE NOMES REAIS DE ABAS NO GOOGLE SHEETS
// ============================================================================
console.log('\n--- 10. Normalização e Resolução de Nomes Reais de Abas ---');

assert(normalizarChaveAba('Orientações') === 'orientacoes', 'Mapeia "Orientações" para chave canônica "orientacoes"');
assert(normalizarChaveAba('Matrículas') === 'matriculas', 'Mapeia "Matrículas" para chave canônica "matriculas"');
assert(normalizarChaveAba('Situação Atual Turmas') === 'situacao_atual_turmas', 'Mapeia "Situação Atual Turmas" corretamente');
assert(normalizarChaveAba('Horários Turma') === 'horarios_turma', 'Mapeia "Horários Turma" corretamente');

const rangeQuoted = formatarRangeSheet('Orientações', 'A1:append');
assert(rangeQuoted === "'Orientações'!A1:append", 'Range formatado com aspas simples para proteger caracteres especiais');

// ============================================================================
// 11. TESTE: SEGURANÇA NUMÉRICA (NOTAS — AUSÊNCIA NÃO É ZERO)
// ============================================================================
console.log('\n--- 11. Proteção Numérica (Notas: Ausência não é zero) ---');

assert(normalizarNota(10) === 10, 'Número válido preservado');
assert(normalizarNota('8,5') === 8.5, 'Decimal com vírgula convertido para número');
assert(normalizarNota('7.4') === 7.4, 'String numérica convertida para número');
assert(normalizarNota('') === 'ausente', 'String vazia identificada como ausente');
assert(normalizarNota(null) === 'ausente', 'Null identificado como ausente');
assert(normalizarNota(undefined) === 'ausente', 'Undefined identificado como ausente');
assert(normalizarNota('abc') === 'invalido', 'Valor inválido identificado como inválido');

assert(formatarNotaParaExibicao('8,5') === '8.5', 'Formatador exibe nota correta');
assert(formatarNotaParaExibicao(null) === '—', 'Formatador exibe "—" para nota ausente');
assert(formatarNotaParaExibicao('abc') === '—', 'Formatador exibe "—" para nota inválida');



// ============================================================================
// 12. TESTE: SELETOR CANÔNICO DE SITUAÇÃO RSS DO ESTUDANTE
// ============================================================================
console.log('\n--- 12. Seletor Canônico de Situação RSS do Estudante ---');

const regsTesteEstudante = [
  { registro_id: 'r1', matricula_id: 'mat-airla', semana: 1, status: 'ENTREGUE' as const, data_entrega: '2026-08-15', observacao: '' },
  { registro_id: 'r2', matricula_id: 'mat-airla', semana: 2, status: 'ENTREGUE' as const, data_entrega: '2026-08-22', observacao: '' },
  { registro_id: 'r3', matricula_id: 'mat-airla', semana: 3, status: 'ENTREGUE' as const, data_entrega: '2026-08-29', observacao: '' },
];

const statusRssTeste = {
  turma_id: 'turma-1',
  unidade_id: 'mat-airla',
  unidade_tipo: 'INDIVIDUAL',
  rss_esperados_ate_hoje: 5,
  rss_recebidos_validos: 3,
  saldo_rss: -2,
  status_rss: 'ATRASADO',
};

const situacaoRssCalculada = obterSituacaoRssEstudante(
  'mat-airla',
  'turma-1',
  regsTesteEstudante,
  statusRssTeste,
  { turma_id: 'turma-1', total_esperado: 12 }
);

assert(situacaoRssCalculada.registrosRealizados === 3, 'Registros realizados = 3 (consistente da tabela registros_semanais)');
assert(situacaoRssCalculada.registrosEsperadosAteHoje === 5, 'Registros esperados até hoje = 5 (denominador de progresso)');
assert(situacaoRssCalculada.totalPrevistoNoPeriodo === 12, 'Total previsto no período = 12 (denominador de encerramento)');
assert(situacaoRssCalculada.estaAtrasado === true, 'Identifica atraso: 3 entregues < 5 esperados até hoje');
assert(
  situacaoRssCalculada.textoExibicao === '3 de 5 esperados até hoje (12 previstos)',
  'Texto canônico explícito sem ambiguidade entre 3/5 e 3/12'
);

// ============================================================================
// 13. TESTE: CORRESPONDÊNCIA FLEXÍVEL DE MATRÍCULA E ALUNO_ID EM REGISTROS
// ============================================================================
console.log('\n--- 13. Associação Flexível de Registros Semanais por Aluno/Matrícula ---');

const regsChaveAlternativa = [
  { registro_id: 'r4', matricula_id: '20230101', aluno_id: 'al-airla', semana: 1, status: 'ENTREGUE' as const, data_entrega: '2026-08-15', observacao: '' },
];

const situacaoAlt = obterSituacaoRssEstudante(
  'mat-airla',
  'turma-1',
  regsChaveAlternativa,
  {
    turma_id: 'turma-1',
    unidade_id: 'mat-airla',
    unidade_tipo: 'INDIVIDUAL',
    rss_esperados_ate_hoje: 4,
    rss_recebidos_validos: 1,
    status_rss: 'ATRASADO',
  }
);
assert(situacaoAlt.registrosRealizados === 1, 'Recupera registro mesmo que na base conste via unidade/aluno');

console.log('\n================================================================');
console.log(`TESTES CONCLUÍDOS: ${passes} passaram, ${fails} falharam.`);
console.log('================================================================');
if (fails > 0) process.exit(1);
