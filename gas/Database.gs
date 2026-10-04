/**
 * CENTRAL DE SUPERVISÃO - Database.gs (Versão 1.2.1)
 *
 * Base oficial: Central de Supervisão - DESENVOLVIMENTO
 * Spreadsheet ID: 1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4
 *
 * Estrutura das 18 tabelas normalizadas e rotina de inicialização segura.
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
  'status_rss_unidades': ['turma_id', 'unidade_id', 'unidade_tipo', 'unidade_nome', 'rss_esperados_ate_hoje', 'rss_recebidos_validos', 'saldo_rss', 'status_rss', 'atualizado_em'],
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

function setupInitialDatabase() {
  var ss = getSpreadsheet();
  
  Object.keys(SCHEMAS).forEach(function(tableName) {
    var sheet = ss.getSheetByName(tableName);
    var headers = SCHEMAS[tableName];
    
    if (!sheet) {
      sheet = ss.insertSheet(tableName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else {
      var existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      headers.forEach(function(expected, i) {
        if (existingHeaders[i] !== expected) {
          throw new Error("ERRO ESTRUTURAL: Tabela [" + tableName + "], Coluna " + (i+1) + ". Esperado: '" + expected + "', Encontrado: '" + existingHeaders[i] + "'.");
        }
      });
    }
  });
}
