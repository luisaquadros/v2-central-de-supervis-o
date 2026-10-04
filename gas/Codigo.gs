/**
 * CENTRAL DE SUPERVISÃO - Codigo.gs (Produção Google Apps Script)
 *
 * Base oficial: Central de Supervisão - DESENVOLVIMENTO
 * Spreadsheet ID: 1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4
 *
 * Funções de inicialização do HTML Service e API de leitura/gravação
 * para comunicação nativa e segura via google.script.run
 */

var OFFICIAL_SPREADSHEET_ID = '1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4';

function getSpreadsheet() {
  if (OFFICIAL_SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(OFFICIAL_SPREADSHEET_ID);
    } catch (e) {
      Logger.log("Aviso ao abrir por ID: " + e.message);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Central de Supervisão')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Lê uma aba da planilha e converte as linhas em objetos simples usando os cabeçalhos.
 * Converte objetos Date em strings YYYY-MM-DD para serialização perfeita.
 * Consome EXCLUSIVAMENTE as tabelas normalizadas.
 */
function readSheetData(sheetName, headers) {
  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var actualHeaders = headers;
  if (!actualHeaders || actualHeaders.length === 0) {
    actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, actualHeaders.length).getValues();
  var tz = Session.getScriptTimeZone() || "GMT-3";

  return values.map(function(row) {
    var item = {};
    actualHeaders.forEach(function(header, colIdx) {
      if (!header) return;
      var val = row[colIdx];
      if (val instanceof Date) {
        item[header] = Utilities.formatDate(val, tz, "yyyy-MM-dd");
      } else {
        item[header] = (val === null || val === undefined) ? "" : val;
      }
    });
    return item;
  });
}

/**
 * Leitura em lote de todas as tabelas normalizadas da base oficial.
 */
function getDadosIniciais() {
  var ss = getSpreadsheet();
  if (!ss) {
    throw new Error("Planilha oficial (" + OFFICIAL_SPREADSHEET_ID + ") não encontrada.");
  }

  // Definição dos cabeçalhos esperados
  var headersPeriodos = ['periodo_id', 'nome', 'data_inicio', 'data_fim', 'status'];
  var headersDisciplinas = ['disciplina_id', 'codigo', 'nome', 'tipo'];
  var headersTurmas = ['turma_id', 'periodo_id', 'disciplina_id', 'nome', 'turno', 'status'];
  var headersHorarios = ['horario_id', 'turma_id', 'dia_semana', 'hora_inicio', 'hora_fim', 'data_inicio', 'data_fim', 'ativo'];
  var headersOrigem = ['origem_id', 'turma_id', 'sistema', 'codigo_externo', 'nome_externo', 'ativo'];
  var headersAlunos = ['aluno_id', 'nome', 'identificador_academico', 'status'];
  var headersMatriculas = ['matricula_id', 'aluno_id', 'turma_id', 'periodo_id', 'status'];
  var headersOrientacoes = ['orientacao_id', 'matricula_id', 'data_hora', 'categoria', 'texto', 'status', 'criado_em', 'atualizado_em'];
  var headersCriterios = ['criterio_id', 'periodo_id', 'disciplina_id', 'turma_id', 'instrumento_avaliacao', 'nome', 'nota_maxima', 'peso', 'ordem', 'ativo'];
  var headersConfig = ['configuracao_id', 'chave', 'valor', 'periodo_id', 'disciplina_id', 'turma_id'];
  var headersMarcos = ['marco_id', 'periodo_id', 'disciplina_id', 'turma_id', 'nome', 'tipo', 'data_prazo', 'status', 'observacao'];
  var headersPontos = ['ponto_id', 'matricula_id', 'texto', 'status', 'prioridade', 'data_criacao', 'atualizado_em', 'data_conclusao'];
  var headersFrequencias = ['frequencia_id', 'matricula_id', 'data_aula', 'status', 'justificativa', 'origem_id', 'criado_em', 'atualizado_em'];
  var headersDocumentos = ['documento_id', 'matricula_id', 'tipo', 'status', 'data_entrega', 'observacao'];
  var headersRegistros = ['registro_id', 'matricula_id', 'semana', 'status', 'data_entrega', 'observacao'];
  var headersAvaliacoes = ['avaliacao_id', 'matricula_id', 'criterio_id', 'nota', 'observacao'];
  var headersFeedbacks = ['feedback_id', 'matricula_id', 'data_hora', 'texto'];
  var headersOcorrencias = ['ocorrencia_id', 'matricula_id', 'data_hora', 'tipo', 'observacao'];

  return {
    periodos: readSheetData('periodos', headersPeriodos),
    disciplinas: readSheetData('disciplinas', headersDisciplinas),
    turmas: readSheetData('turmas', headersTurmas),
    horarios: readSheetData('horarios_turma', headersHorarios),
    turmasOrigem: readSheetData('turmas_origem', headersOrigem),
    alunos: readSheetData('alunos', headersAlunos),
    matriculas: readSheetData('matriculas', headersMatriculas),
    orientacoes: readSheetData('orientacoes', headersOrientacoes),
    criterios: readSheetData('criterios_avaliacao', headersCriterios),
    configuracoes: readSheetData('configuracoes', headersConfig),
    marcos: readSheetData('marcos_academicos', headersMarcos),
    pontosAcompanhamento: readSheetData('pontos_acompanhamento', headersPontos),
    frequencias: readSheetData('frequencias', headersFrequencias),
    documentos: readSheetData('documentos', headersDocumentos),
    registrosSemanais: readSheetData('registros_semanais', headersRegistros),
    avaliacoes: readSheetData('avaliacoes', headersAvaliacoes),
    feedbacks: readSheetData('feedback_alunos', headersFeedbacks),
    ocorrencias: readSheetData('ocorrencias', headersOcorrencias),
    // 12 Tabelas Adicionais Normalizadas
    regrasRss: readSheetData('regras_rss', []),
    calendarioRss: readSheetData('calendario_rss', []),
    statusRssUnidades: readSheetData('status_rss_unidades', []),
    situacaoAtualTurmas: readSheetData('situacao_atual_turmas', []),
    leiturasResponsaveis: readSheetData('leituras_responsaveis', []),
    regrasPrazo: readSheetData('regras_prazo', []),
    gruposPratica: readSheetData('grupos_pratica', []),
    grupoIntegrantes: readSheetData('grupo_integrantes', []),
    entregas: readSheetData('entregas', []),
    feedbacksOficiais: readSheetData('feedbacks', []),
    registrosSupervisao: readSheetData('registros_supervisao', []),
    sincronizacao: readSheetData('sincronizacao', []),
    // Documentação e Contrato da Base Oficial
    dicionarioDados: readSheetData('dicionario_dados', []),
    contratoApp: readSheetData('contrato_app', []),
    mapeamentoFontes: readSheetData('mapeamento_fontes', []),
    auditoriaBase: readSheetData('auditoria_base', [])
  };
}

/**
 * PRIMEIRO TESTE VERTICAL DE GRAVAÇÃO:
 * Grava uma nova orientação diretamente na aba 'orientacoes' e devolve o registro salvo.
 */
function salvarNovaOrientacao(payload) {
  if (!payload || !payload.matricula_id || !payload.texto) {
    throw new Error("Dados incompletos para salvar orientação.");
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('orientacoes');
  if (!sheet) {
    throw new Error("Aba 'orientacoes' não encontrada na planilha.");
  }

  var tz = Session.getScriptTimeZone() || "GMT-3";
  var now = new Date();
  var nowFormatted = Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ss");
  var newId = Utilities.getUuid();

  var newRow = [
    newId,
    payload.matricula_id,
    now,
    payload.categoria || "Geral",
    payload.texto,
    payload.status || "ABERTA",
    now,
    now
  ];

  sheet.appendRow(newRow);

  return {
    orientacao_id: newId,
    matricula_id: payload.matricula_id,
    data_hora: nowFormatted,
    categoria: payload.categoria || "Geral",
    texto: payload.texto,
    status: payload.status || "ABERTA",
    criado_em: nowFormatted,
    atualizado_em: nowFormatted
  };
}
