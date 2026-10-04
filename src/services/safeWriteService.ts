/**
 * CENTRAL DE SUPERVISÃO - ARQUITETURA DE ESCRITA SEGURA
 *
 * Garante que:
 * 1. Somente tabelas normalizadas autorizadas recebam gravações;
 * 2. Abas-fonte, backups, cópias e rascunhos NUNCA sejam modificadas pelo aplicativo;
 * 3. IDs gerados sejam estáveis e persistentes;
 * 4. Validação prévia de integridade de dados antes de submeter ao Google Sheets / GAS;
 * 5. Nenhuma gravação ambígua seja executada.
 */

export const TABELAS_AUTORIZADAS_ESCRITA = [
  'periodos',
  'disciplinas',
  'turmas',
  'horarios_turma',
  'turmas_origem',
  'alunos',
  'matriculas',
  'orientacoes',
  'registros_semanais',
  'documentos',
  'avaliacoes',
  'feedback_alunos',
  'criterios_avaliacao',
  'ocorrencias',
  'configuracoes',
  'frequencias',
  'pontos_acompanhamento',
  'marcos_academicos',
  'entregas',
  'feedbacks',
  'registros_supervisao',
  'grupos_pratica',
  'grupo_integrantes',
] as const;

export type TabelaAutorizada = typeof TABELAS_AUTORIZADAS_ESCRITA[number];

/**
 * Validação rigorosa antes de qualquer mutação de dados
 */
export function validarEscritaTabela(
  tabela: string,
  registro: Record<string, any>
): { valido: boolean; motivo?: string } {
  if (!tabela || typeof tabela !== 'string') {
    return { valido: false, motivo: 'Nome de tabela não fornecido.' };
  }

  const nomeNormalizado = tabela.toLowerCase().trim();

  // Bloqueio categórico de abas não-destinatárias (fonte, backup, rascunho, etc.)
  if (
    nomeNormalizado.startsWith('fonte') ||
    nomeNormalizado.startsWith('origem') ||
    nomeNormalizado.startsWith('backup') ||
    nomeNormalizado.startsWith('rascunho') ||
    nomeNormalizado.includes('copia') ||
    nomeNormalizado.includes('temp') ||
    nomeNormalizado.includes('raw')
  ) {
    return {
      valido: false,
      motivo: `Tentativa de escrita bloqueada: a aba '${tabela}' é protegida e de uso exclusivo da base oficial.`,
    };
  }

  // Verifica se está na lista branca das tabelas normalizadas autorizadas
  if (!TABELAS_AUTORIZADAS_ESCRITA.includes(tabela as TabelaAutorizada)) {
    return {
      valido: false,
      motivo: `A tabela '${tabela}' não é uma tabela normalizada autorizada para mutações.`,
    };
  }

  if (!registro || typeof registro !== 'object') {
    return { valido: false, motivo: 'Objeto de registro inválido.' };
  }

  return { valido: true };
}

/**
 * Gerador de IDs estáveis para novas entidades
 */
export function gerarIdEstavel(prefixo: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${prefixo}_${timestamp}_${randomPart}`;
}
