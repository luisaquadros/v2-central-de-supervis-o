import React, { useState } from 'react';
import {
  Settings,
  Download,
  Upload,
  RefreshCw,
  Code2,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Layers,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

export const ConfiguracoesView: React.FC = () => {
  const {
    criterios,
    configuracoes,
    resetDatabaseToSeed,
    exportDatabaseAsJson,
    importarAlunosLote,
    turmas,
    connectionStatus,
    saveStatus,
    spreadsheetId,
    spreadsheetName,
    spreadsheetUrl,
  } = useSupervisao();

  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'guia_seguranca' | 'codigo_gas' | 'database_gas' | 'importar'>('geral');
  const [copiedDatabase, setCopiedDatabase] = useState(false);
  const [copiedCodigo, setCopiedCodigo] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Import state
  const [selectedTurmaImport, setSelectedTurmaImport] = useState(
    turmas.length > 0 ? turmas[0].turma_id : ''
  );
  const [importText, setImportText] = useState(
    'Ana Clara Vieira\tRA202616\nBruno Henrique Lima\tRA202617\nCamila Duarte\tRA202618'
  );
  const [importResult, setImportResult] = useState<{ adicionados: number; duplicados: number } | null>(
    null
  );

  const handleExportJson = () => {
    const dataStr = exportDatabaseAsJson();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `central_supervisao_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim() || !selectedTurmaImport) return;

    const lines = importText.split('\n');
    const parsedList: { nome: string; identificador_academico: string }[] = [];

    lines.forEach(line => {
      const parts = line.split(/[\t,;]/);
      if (parts.length >= 1 && parts[0].trim()) {
        const nome = parts[0].trim();
        const ra = parts.length > 1 ? parts[1].trim() : `RA${Date.now()}`;
        parsedList.push({ nome, identificador_academico: ra });
      }
    });

    const result = await importarAlunosLote(selectedTurmaImport, parsedList);
    setImportResult(result);
  };

  const copyToClipboard = (text: string, type: 'database' | 'codigo') => {
    navigator.clipboard.writeText(text);
    if (type === 'database') {
      setCopiedDatabase(true);
      setTimeout(() => setCopiedDatabase(false), 2000);
    } else {
      setCopiedCodigo(true);
      setTimeout(() => setCopiedCodigo(false), 2000);
    }
  };

  // -------------------------------------------------------------
  // CÓDIGO FONTE OFICIAL DO GOOGLE APPS SCRIPT: Database.gs
  // -------------------------------------------------------------
  const gasDatabaseCode = `/**
 * CENTRAL DE SUPERVISÃO - BANCO DE DADOS GOOGLE SHEETS
 * Arquivo: Database.gs
 * Versão: 1.2.1 (18 Tabelas Normalizadas)
 *
 * Base oficial: Central de Supervisão - DESENVOLVIMENTO
 * Spreadsheet ID: 1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4
 */

const OFFICIAL_SPREADSHEET_ID = '1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4';

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

const SCHEMAS = {
  'periodos': ['periodo_id', 'nome', 'data_inicio', 'data_fim', 'status'],
  'disciplinas': ['disciplina_id', 'codigo', 'nome', 'tipo'],
  'turmas': ['turma_id', 'periodo_id', 'disciplina_id', 'nome', 'turno', 'status'],
  'alunos': ['aluno_id', 'nome', 'identificador_academico', 'status'],
  'matriculas': ['matricula_id', 'aluno_id', 'turma_id', 'periodo_id', 'status'],
  'orientacoes': ['orientacao_id', 'matricula_id', 'data_hora', 'categoria', 'texto', 'status', 'criado_em', 'atualizado_em'],
  'registros_semanais': ['registro_id', 'matricula_id', 'semana', 'status', 'data_entrega', 'observacao'],
  'documentos': ['documento_id', 'matricula_id', 'tipo', 'status', 'data_entrega', 'observacao'],
  'avaliacoes': ['avaliacao_id', 'matricula_id', 'criterio_id', 'nota', 'observacao'],
  'feedback_alunos': ['feedback_id', 'matricula_id', 'data_hora', 'texto'],
  'criterios_avaliacao': ['criterio_id', 'periodo_id', 'disciplina_id', 'turma_id', 'nome', 'nota_maxima', 'peso', 'ordem', 'ativo'],
  'ocorrencias': ['ocorrencia_id', 'matricula_id', 'data_hora', 'tipo', 'observacao'],
  'configuracoes': ['configuracao_id', 'chave', 'valor', 'periodo_id', 'disciplina_id', 'turma_id'],
  'turmas_origem': ['origem_id', 'turma_id', 'sistema', 'codigo_externo', 'nome_externo', 'ativo'],
  'frequencias': ['frequencia_id', 'matricula_id', 'data_aula', 'status', 'justificativa', 'origem_id', 'criado_em', 'atualizado_em'],
  'horarios_turma': ['horario_id', 'turma_id', 'dia_semana', 'hora_inicio', 'hora_fim', 'data_inicio', 'data_fim', 'ativo'],
  'pontos_acompanhamento': ['ponto_id', 'matricula_id', 'texto', 'status', 'prioridade', 'data_criacao', 'atualizado_em', 'data_conclusao'],
  'marcos_academicos': ['marco_id', 'periodo_id', 'disciplina_id', 'turma_id', 'nome', 'tipo', 'data_prazo', 'status', 'observacao'],
  // 12 Tabelas Adicionais Normalizadas da Planilha Oficial
  'regras_rss': ['regra_id', 'disciplina_id', 'turma_id', 'total_esperado'],
  'calendario_rss': ['calendario_id', 'turma_id', 'semana', 'data_prevista', 'data_limite'],
  'status_rss_unidades': ['status_unidade_id', 'matricula_id', 'aluno_id', 'semana', 'status_semanal', 'total_esperado_ate_hoje'],
  'situacao_atual_turmas': ['turma_id', 'periodo_id', 'disciplina_id', 'situacao', 'total_alunos', 'total_pendencias'],
  'leituras_responsaveis': ['leitura_id', 'turma_id', 'data', 'tema', 'responsavel_id', 'responsavel_nome', 'aluno_id'],
  'regras_prazo': ['prazo_id', 'tipo', 'dias_tolerancia', 'descricao'],
  'grupos_pratica': ['grupo_id', 'turma_id', 'nome_grupo', 'descricao'],
  'grupo_integrantes': ['integrante_id', 'grupo_id', 'aluno_id', 'matricula_id', 'papel'],
  'entregas': ['entrega_id', 'matricula_id', 'tipo_documento', 'status_entrega', 'data_entrega', 'observacao'],
  'feedbacks': ['feedback_id', 'matricula_id', 'aluno_id', 'data_hora', 'texto'],
  'registros_supervisao': ['registro_id', 'matricula_id', 'data_hora', 'categoria', 'texto', 'status'],
  'sincronizacao': ['sincronizacao_id', 'tabela', 'ultima_atualizacao', 'versao', 'status']
};

/**
 * Cria ou assegura as 18 abas e seus cabeçalhos na Planilha Google oficial
 * Execute esta função apenas 1 vez ao configurar o Apps Script
 */
function setupInitialDatabase() {
  const ss = getSpreadsheet();
  Object.keys(SCHEMAS).forEach(tableName => {
    let sheet = ss.getSheetByName(tableName);
    const headers = SCHEMAS[tableName];
    if (!sheet) {
      sheet = ss.insertSheet(tableName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f1f5f9');
      sheet.setFrozenRows(1);
    }
  });
  Logger.log('Estrutura de 18 tabelas verificada e pronta com sucesso!');
}`;

  // -------------------------------------------------------------
  // CÓDIGO FONTE OFICIAL DO GOOGLE APPS SCRIPT: Codigo.gs
  // -------------------------------------------------------------
  const gasCodigoCode = `/**
 * CENTRAL DE SUPERVISÃO - BACKEND GOOGLE APPS SCRIPT
 * Arquivo: Codigo.gs
 *
 * Base oficial: Central de Supervisão - DESENVOLVIMENTO
 * Spreadsheet ID: 1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4
 * Comunicação direta com o Frontend via google.script.run
 */

const OFFICIAL_SPREADSHEET_ID = '1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4';

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
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Central de Supervisão')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Helper para ler todos os dados de uma aba normalizada como array de objetos
 */
function readSheetObjects(sheetName, schemaFields) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, schemaFields.length).getValues();
  return values.map(row => {
    const obj = {};
    schemaFields.forEach((field, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0];
      }
      obj[field] = val !== undefined ? val : '';
    });
    return obj;
  });
}

/**
 * 1. LEITURA EM LOTE DE TODAS AS 18 TABELAS
 */
function getDadosIniciais() {
  return {
    periodos: readSheetObjects('periodos', SCHEMAS.periodos),
    disciplinas: readSheetObjects('disciplinas', SCHEMAS.disciplinas),
    turmas: readSheetObjects('turmas', SCHEMAS.turmas),
    alunos: readSheetObjects('alunos', SCHEMAS.alunos),
    matriculas: readSheetObjects('matriculas', SCHEMAS.matriculas),
    orientacoes: readSheetObjects('orientacoes', SCHEMAS.orientacoes),
    registrosSemanais: readSheetObjects('registros_semanais', SCHEMAS.registros_semanais),
    documentos: readSheetObjects('documentos', SCHEMAS.documentos),
    avaliacoes: readSheetObjects('avaliacoes', SCHEMAS.avaliacoes),
    feedbacks: readSheetObjects('feedback_alunos', SCHEMAS.feedback_alunos),
    criterios: readSheetObjects('criterios_avaliacao', SCHEMAS.criterios_avaliacao),
    ocorrencias: readSheetObjects('ocorrencias', SCHEMAS.ocorrencias),
    configuracoes: readSheetObjects('configuracoes', SCHEMAS.configuracoes),
    turmasOrigem: readSheetObjects('turmas_origem', SCHEMAS.turmas_origem),
    frequencias: readSheetObjects('frequencias', SCHEMAS.frequencias),
    horarios: readSheetObjects('horarios_turma', SCHEMAS.horarios_turma),
    pontosAcompanhamento: readSheetObjects('pontos_acompanhamento', SCHEMAS.pontos_acompanhamento),
    marcos: readSheetObjects('marcos_academicos', SCHEMAS.marcos_academicos),
    regrasRss: readSheetObjects('regras_rss', SCHEMAS.regras_rss),
    calendarioRss: readSheetObjects('calendario_rss', SCHEMAS.calendario_rss),
    statusRssUnidades: readSheetObjects('status_rss_unidades', SCHEMAS.status_rss_unidades),
    situacaoAtualTurmas: readSheetObjects('situacao_atual_turmas', SCHEMAS.situacao_atual_turmas),
    leiturasResponsaveis: readSheetObjects('leituras_responsaveis', SCHEMAS.leituras_responsaveis),
    regrasPrazo: readSheetObjects('regras_prazo', SCHEMAS.regras_prazo),
    gruposPratica: readSheetObjects('grupos_pratica', SCHEMAS.grupos_pratica),
    grupoIntegrantes: readSheetObjects('grupo_integrantes', SCHEMAS.grupo_integrantes),
    entregas: readSheetObjects('entregas', SCHEMAS.entregas),
    feedbacksOficiais: readSheetObjects('feedbacks', SCHEMAS.feedbacks),
    registrosSupervisao: readSheetObjects('registros_supervisao', SCHEMAS.registros_supervisao),
    sincronizacao: readSheetObjects('sincronizacao', SCHEMAS.sincronizacao)
  };
}

/**
 * 2. GRAVAÇÃO DE ORIENTAÇÃO
 */
function salvarNovaOrientacao(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('orientacoes');
  const now = new Date().toISOString();
  const id = Utilities.getUuid();

  const newRow = [
    id,
    payload.matricula_id,
    now,
    payload.categoria || 'Geral',
    payload.texto,
    payload.status || 'ABERTA',
    now,
    now
  ];

  sheet.appendRow(newRow);

  return {
    orientacao_id: id,
    matricula_id: payload.matricula_id,
    data_hora: now,
    categoria: payload.categoria || 'Geral',
    texto: payload.texto,
    status: payload.status || 'ABERTA',
    criado_em: now,
    atualizado_em: now
  };
}

function atualizarStatusOrientacao(orientacaoId, novoStatus) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('orientacoes');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === orientacaoId) {
      sheet.getRange(i + 1, 6).setValue(novoStatus); // coluna status (6)
      sheet.getRange(i + 1, 8).setValue(new Date().toISOString()); // atualizado_em (8)
      return;
    }
  }
}

function excluirOrientacao(orientacaoId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('orientacoes');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === orientacaoId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

/**
 * 3. GRAVAÇÃO DE TURMAS E HORÁRIOS (DINÂMICAS)
 */
function salvarTurma(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('turmas');
  const id = payload.turma_id || Utilities.getUuid();

  // Verifica se é edição
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowValues = [
    id,
    payload.periodo_id,
    payload.disciplina_id,
    payload.nome,
    payload.turno,
    payload.status || 'ATIVO'
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 6).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  // Horários
  if (payload.horarios && Array.isArray(payload.horarios)) {
    const hSheet = ss.getSheetByName('horarios_turma');
    payload.horarios.forEach(h => {
      hSheet.appendRow([
        Utilities.getUuid(),
        id,
        h.dia_semana,
        h.hora_inicio,
        h.hora_fim,
        h.data_inicio || '2026-08-01',
        h.data_fim || '2026-12-20',
        true
      ]);
    });
  }

  // Códigos Externos Docente Online
  if (payload.origens && Array.isArray(payload.origens)) {
    const oSheet = ss.getSheetByName('turmas_origem');
    payload.origens.forEach(o => {
      oSheet.appendRow([
        Utilities.getUuid(),
        id,
        o.sistema || 'Docente Online',
        o.codigo_externo,
        o.nome_externo || payload.nome,
        true
      ]);
    });
  }

  return {
    turma_id: id,
    periodo_id: payload.periodo_id,
    disciplina_id: payload.disciplina_id,
    nome: payload.nome,
    turno: payload.turno,
    status: payload.status || 'ATIVO'
  };
}

function atualizarStatusTurma(turmaId, novoStatus) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('turmas');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === turmaId) {
      sheet.getRange(i + 1, 6).setValue(novoStatus); // status (6)
      return;
    }
  }
}

/**
 * 4. PONTOS DE ACOMPANHAMENTO
 */
function salvarPontoAcompanhamento(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('pontos_acompanhamento');
  const id = Utilities.getUuid();
  const today = new Date().toISOString().split('T')[0];

  const row = [
    id,
    payload.matricula_id,
    payload.texto,
    'ATIVO',
    payload.prioridade || 'ALTA',
    today,
    today,
    ''
  ];
  sheet.appendRow(row);

  return {
    ponto_id: id,
    matricula_id: payload.matricula_id,
    texto: payload.texto,
    status: 'ATIVO',
    prioridade: payload.prioridade || 'ALTA',
    data_criacao: today,
    atualizado_em: today
  };
}

function atualizarStatusPonto(pontoId, novoStatus, dataConclusao) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('pontos_acompanhamento');
  const data = sheet.getDataRange().getValues();
  const today = new Date().toISOString().split('T')[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === pontoId) {
      sheet.getRange(i + 1, 4).setValue(novoStatus); // status
      sheet.getRange(i + 1, 7).setValue(today); // atualizado_em
      sheet.getRange(i + 1, 8).setValue(dataConclusao || ''); // data_conclusao
      return;
    }
  }
}

function excluirPontoAcompanhamento(pontoId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('pontos_acompanhamento');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === pontoId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

/**
 * 5. FEEDBACKS E OCORRÊNCIAS
 */
function salvarFeedback(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('feedback_alunos');
  const id = Utilities.getUuid();
  const now = new Date().toISOString();

  sheet.appendRow([id, payload.matricula_id, now, payload.texto]);
  return { feedback_id: id, matricula_id: payload.matricula_id, data_hora: now, texto: payload.texto };
}

function excluirFeedback(feedbackId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('feedback_alunos');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === feedbackId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function salvarOcorrencia(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('ocorrencias');
  const id = Utilities.getUuid();
  const now = new Date().toISOString();

  sheet.appendRow([id, payload.matricula_id, now, payload.tipo, payload.observacao]);
  return { ocorrencia_id: id, matricula_id: payload.matricula_id, data_hora: now, tipo: payload.tipo, observacao: payload.observacao };
}

function excluirOcorrencia(ocorrenciaId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('ocorrencias');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === ocorrenciaId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

/**
 * 6. FREQUÊNCIA
 */
function salvarFrequencia(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('frequencias');
  const id = Utilities.getUuid();
  const now = new Date().toISOString();

  const row = [
    id,
    payload.matricula_id,
    payload.data_aula,
    payload.status,
    payload.justificativa || '',
    payload.origem_id || '',
    now,
    now
  ];
  sheet.appendRow(row);

  return {
    frequencia_id: id,
    matricula_id: payload.matricula_id,
    data_aula: payload.data_aula,
    status: payload.status,
    justificativa: payload.justificativa || '',
    origem_id: payload.origem_id || '',
    criado_em: now,
    atualizado_em: now
  };
}

function atualizarFrequencia(frequenciaId, status, justificativa) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('frequencias');
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === frequenciaId) {
      sheet.getRange(i + 1, 4).setValue(status); // status
      if (justificativa !== undefined) {
        sheet.getRange(i + 1, 5).setValue(justificativa); // justificativa
      }
      sheet.getRange(i + 1, 8).setValue(now); // atualizado_em
      return;
    }
  }
}

/**
 * 7. REGISTROS SEMANAIS & DOCUMENTOS
 */
function salvarRegistroSemanal(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('registros_semanais');
  const data = sheet.getDataRange().getValues();
  const today = new Date().toISOString().split('T')[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === payload.matricula_id && data[i][2] == payload.semana) {
      sheet.getRange(i + 1, 4).setValue(payload.status);
      sheet.getRange(i + 1, 5).setValue(payload.status === 'ENTREGUE' ? today : '');
      sheet.getRange(i + 1, 6).setValue(payload.observacao || '');
      return;
    }
  }

  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    payload.matricula_id,
    payload.semana,
    payload.status,
    payload.status === 'ENTREGUE' ? today : '',
    payload.observacao || ''
  ]);
}

function salvarDocumento(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('documentos');
  const id = Utilities.getUuid();
  const today = new Date().toISOString().split('T')[0];

  sheet.appendRow([
    id,
    payload.matricula_id,
    payload.tipo,
    payload.status || 'PENDENTE',
    payload.status === 'ENTREGUE' ? today : '',
    payload.observacao || ''
  ]);

  return {
    documento_id: id,
    matricula_id: payload.matricula_id,
    tipo: payload.tipo,
    status: payload.status || 'PENDENTE',
    data_entrega: payload.status === 'ENTREGUE' ? today : '',
    observacao: payload.observacao || ''
  };
}

function atualizarDocumento(documentoId, status, observacao) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('documentos');
  const data = sheet.getDataRange().getValues();
  const today = new Date().toISOString().split('T')[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === documentoId) {
      sheet.getRange(i + 1, 4).setValue(status);
      if (status === 'ENTREGUE') sheet.getRange(i + 1, 5).setValue(today);
      if (observacao !== undefined) sheet.getRange(i + 1, 6).setValue(observacao);
      return;
    }
  }
}

/**
 * 8. AVALIAÇÕES
 */
function salvarAvaliacao(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('avaliacoes');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === payload.matricula_id && data[i][2] === payload.criterio_id) {
      sheet.getRange(i + 1, 4).setValue(payload.nota);
      sheet.getRange(i + 1, 5).setValue(payload.observacao || '');
      return;
    }
  }

  const id = Utilities.getUuid();
  sheet.appendRow([id, payload.matricula_id, payload.criterio_id, payload.nota, payload.observacao || '']);
}

/**
 * 9. IMPORTAÇÃO EM LOTE DE ALUNOS
 */
function importarAlunosLote(payload) {
  const ss = getSpreadsheet();
  const aSheet = ss.getSheetByName('alunos');
  const mSheet = ss.getSheetByName('matriculas');

  const alunosData = aSheet.getDataRange().getValues();
  const matriculasData = mSheet.getDataRange().getValues();

  let adicionados = 0;
  let duplicados = 0;

  payload.alunos.forEach(item => {
    const nome = item.nome.trim();
    const ra = item.identificador_academico.trim();
    if (!nome) return;

    let alunoId = '';
    for (let i = 1; i < alunosData.length; i++) {
      if (alunosData[i][2] && alunosData[i][2].toString().toLowerCase() === ra.toLowerCase()) {
        alunoId = alunosData[i][0];
        break;
      }
    }

    if (alunoId) {
      let jaMatriculado = false;
      for (let j = 1; j < matriculasData.length; j++) {
        if (matriculasData[j][1] === alunoId && matriculasData[j][2] === payload.turma_id) {
          jaMatriculado = true;
          break;
        }
      }
      if (jaMatriculado) {
        duplicados++;
        return;
      }
    } else {
      alunoId = Utilities.getUuid();
      aSheet.appendRow([alunoId, nome, ra, 'ATIVO']);
    }

    const matId = Utilities.getUuid();
    mSheet.appendRow([matId, alunoId, payload.turma_id, payload.periodo_id, 'MATRICULADO']);
    adicionados++;
  });

  return { adicionados: adicionados, duplicados: duplicados };
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Configurações & Conexão Google Sheets</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Arquitetura nativa Google Apps Script (Opção B: Somente Eu · google.script.run)
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto shadow-xs">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => setActiveSubTab('geral')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'geral'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Visão Geral & Parâmetros
          </button>
          <button
            onClick={() => setActiveSubTab('guia_seguranca')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'guia_seguranca'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Guia de Implantação e Segurança</span>
          </button>
          <button
            onClick={() => setActiveSubTab('codigo_gas')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'codigo_gas'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Backend: Codigo.gs
          </button>
          <button
            onClick={() => setActiveSubTab('database_gas')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'database_gas'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Estrutura: Database.gs (30 Tabelas)
          </button>
          <button
            onClick={() => setActiveSubTab('importar')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'importar'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Importar Alunos
          </button>
        </div>
      </div>

      {/* 1. ABA GERAL */}
      {activeSubTab === 'geral' && (
        <div className="space-y-5 text-xs">
          {/* Status da Conexão */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Status do Ambiente</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Ambiente Ativo</span>
                <span className="font-bold text-slate-900">
                  {connectionStatus === 'CONECTADO'
                    ? 'Google Apps Script (Web App)'
                    : 'Prévia Local (Google AI Studio)'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Canal de Comunicação</span>
                <span className="font-mono font-bold text-slate-900">google.script.run (Nativo)</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Segurança e Acesso</span>
                <span className="font-bold text-emerald-700">Somente Eu (Google Auth)</span>
              </div>
            </div>
          </div>

          {/* Base de Dados Oficial Conectada */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Base de Dados Oficial Conectada</h3>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                30 Tabelas Normalizadas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Nome da Planilha</span>
                <span className="font-bold text-slate-900">{spreadsheetName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Spreadsheet ID</span>
                <span className="font-mono font-semibold text-slate-800 text-[11px] break-all">{spreadsheetId}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
              <span>Consumo restrito às tabelas normalizadas. Abas-fonte e backups protegidos contra escrita.</span>
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-900 underline font-semibold hover:text-slate-700 shrink-0 ml-2"
              >
                Abrir Planilha Oficial
              </a>
            </div>
          </div>

          {/* Tabela Oficial configuracoes da Base */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Parâmetros do Sistema (Tabela configuracoes)</h3>
                <p className="text-[11px] text-slate-500">Chaves e valores registrados na aba normalizada da base</p>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Total: {configuracoes.length}</span>
            </div>

            {configuracoes.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-500 text-xs">
                Nenhuma configuração personalizada registrada na base. As diretrizes padrão do semestre estão ativas.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {configuracoes.map((cfg, idx) => (
                  <div key={cfg.configuracao_id || idx} className="p-3 flex items-center justify-between bg-white text-xs">
                    <div>
                      <span className="font-mono font-bold text-slate-800">{cfg.chave || 'CHAVE_SEM_NOME'}</span>
                      {(cfg.turma_id || cfg.disciplina_id) && (
                        <span className="text-[10px] text-slate-400 ml-2">
                          {cfg.turma_id ? `Turma: ${cfg.turma_id}` : `Disciplina: ${cfg.disciplina_id}`}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono text-[11px]">
                      {cfg.valor || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Governança Acadêmica e Regras Institucionais */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Governança Acadêmica & Regras Institucionais (Somente Leitura)
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tabelas como <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">regras_rss</code>, <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">regras_prazo</code>, <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">contrato_app</code> e <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">dicionario_dados</code> contêm diretrizes normativas da coordenação acadêmica. Elas são gerenciadas exclusivamente na planilha oficial do Google Sheets e <strong>não podem ser modificadas como preferências comuns pelo aplicativo</strong> para garantir a integridade dos dados e o cumprimento das normas pedagógicas.
            </p>
          </div>

          {/* Critérios de Avaliação Ativos */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Critérios de Avaliação do Semestre</h3>
              <span className="text-slate-400">Total: {criterios.length} critérios</span>
            </div>
            {criterios.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-500 text-xs">
                Nenhum critério de avaliação registrado na base oficial.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {criterios.map(c => {
                  const notaMax = Number(c.nota_maxima || 0);
                  return (
                    <div key={c.criterio_id} className="p-3 flex items-center justify-between bg-white">
                      <div>
                        <span className="font-bold text-slate-800">{c.nome}</span>
                        {c.ordem !== undefined && c.ordem !== null && (
                          <span className="text-slate-400 ml-2">Ordem {c.ordem}</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        Nota Máx: {notaMax.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Backup e Reset */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Backup e Manutenção</h3>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExportJson}
                className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Dados em JSON (30 Tabelas)</span>
              </button>

              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="px-4 py-2.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Redefinir Estrutura Padrão (Sem Mocks)</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-red-700 font-medium">Confirmar restauração?</span>
                  <button
                    onClick={() => {
                      resetDatabaseToSeed();
                      setConfirmReset(false);
                    }}
                    className="px-3 py-1.5 bg-red-600 text-white font-bold rounded-lg cursor-pointer hover:bg-red-700"
                  >
                    Sim, Restaurar
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. ABA: GUIA DE IMPLANTAÇÃO E SEGURANÇA */}
      {activeSubTab === 'guia_seguranca' && (
        <div className="space-y-5 text-xs">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
              <Lock className="w-4 h-4 text-emerald-700" />
              <span>Arquitetura Aprovada: Web App Privado no Google Apps Script</span>
            </div>
            <p className="text-emerald-800 leading-relaxed">
              Você escolheu a arquitetura mais segura e simples do ecossistema Google. Os dados não passam por servidores de terceiros (sem Firebase, sem Supabase, sem tokens expostos no navegador). O Google autentica diretamente sua sessão na borda.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Instruções Exatas de Implantação no Google Apps Script
            </h3>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Abra o editor de script da sua Planilha</h4>
                  <p className="text-slate-600 mt-0.5">
                    Na sua planilha Google Sheets onde estão as 18 tabelas, clique no menu superior em <strong>Extensões &gt; Apps Script</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Crie os arquivos de código</h4>
                  <p className="text-slate-600 mt-0.5">
                    No Apps Script, crie os arquivos com os nomes exatos:
                  </p>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-700">
                    <li><strong>Database.gs</strong> (Script): Cole o código da aba "Estrutura: Database.gs".</li>
                    <li><strong>Codigo.gs</strong> (Script): Cole o código da aba "Backend: Codigo.gs".</li>
                    <li><strong>Index.html</strong> (HTML): Cole o arquivo compilado único gerado pelo build (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">dist/index.html</code>).</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Configuração Crítica de Implantação (Segurança Máxima)</h4>
                  <p className="text-slate-600 mt-0.5">
                    Clique no botão azul <strong>Implantar &gt; Nova implantação</strong>. Clique no ícone de engrenagem e escolha <strong>App da Web</strong>.
                  </p>
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-medium">
                    <div>
                      <span className="text-slate-400">Descrição:</span>{' '}
                      <span className="text-slate-800">Central de Supervisão v1</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Executar como:</span>{' '}
                      <strong className="text-slate-900">Eu (seu email Google)</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Quem tem acesso:</span>{' '}
                      <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Somente eu
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  4
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Respostas sobre Segurança e Privacidade</h4>
                  <div className="mt-2 space-y-2 text-slate-600">
                    <p>
                      <strong>Como o Google verifica sua identidade?</strong> Pelo login da sua conta Google ativa no navegador ou tablet. Não existe tela de senha feita por nós: a própria infraestrutura corporativa do Google valida sua sessão.
                    </p>
                    <p>
                      <strong>O que acontece se outra pessoa receber o link?</strong> Se qualquer pessoa abrir a URL sem estar autenticada como você, o Google bloqueia imediatamente com erro <em>403 Proibido / Acesso Negado</em>. A interface e os dados acadêmicos sequer são carregados.
                    </p>
                    <p>
                      <strong>Existe algum risco de exposição pública?</strong> Nenhum. Não há chave de API exposta no front, não há permissão para "Qualquer pessoa" e não há servidores intermediários.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ABA: CODIGO.GS */}
      {activeSubTab === 'codigo_gas' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Codigo.gs (Backend Nativo Google Apps Script)
              </h3>
              <p className="text-slate-500">
                Funções de leitura em lote (<code className="font-mono">getDadosIniciais</code>) e gravação de orientações, frequências, turmas dinâmicas, pontos e avaliações.
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(gasCodigoCode, 'codigo')}
              className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copiedCodigo ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCodigo ? 'Copiado!' : 'Copiar Codigo.gs'}</span>
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[500px] leading-relaxed">
              {gasCodigoCode}
            </pre>
          </div>
        </div>
      )}

      {/* 4. ABA: DATABASE.GS */}
      {activeSubTab === 'database_gas' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Database.gs (18 Tabelas Normalizadas)
              </h3>
              <p className="text-slate-500">
                Esquema dos campos e função <code className="font-mono">setupInitialDatabase()</code> para gerar ou validar as 18 abas na sua planilha Google Sheets.
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(gasDatabaseCode, 'database')}
              className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copiedDatabase ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedDatabase ? 'Copiado!' : 'Copiar Database.gs'}</span>
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[500px] leading-relaxed">
              {gasDatabaseCode}
            </pre>
          </div>
        </div>
      )}

      {/* 5. ABA: IMPORTAR ALUNOS */}
      {activeSubTab === 'importar' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Importação em Lote de Alunos</h3>
            <p className="text-slate-500">
              Cole a lista de estudantes a partir do Excel, Google Sheets ou arquivo separado por tabulação/vírgula.
            </p>
          </div>

          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Turma de Destino
              </label>
              <select
                value={selectedTurmaImport}
                onChange={e => setSelectedTurmaImport(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
              >
                {turmas.map(t => (
                  <option key={t.turma_id} value={t.turma_id}>
                    {t.nome} ({t.turno})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Dados dos Alunos (Nome [TAB ou vírgula] RA)
              </label>
              <textarea
                rows={6}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-3 bg-slate-50 font-mono text-xs placeholder:text-slate-400"
                placeholder="Exemplo:\nMariana Silva\tRA202620\nPedro Henrique\tRA202621"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Importar Alunos para a Turma</span>
            </button>
          </form>

          {importResult && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Importação Concluída com Sucesso!</span>
              </div>
              <p>
                <strong>{importResult.adicionados}</strong> aluno(s) adicionados à turma.
                {importResult.duplicados > 0 && (
                  <span> ({importResult.duplicados} já matriculados ignorados).</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
