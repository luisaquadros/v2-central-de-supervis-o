/**
 * Regras de escrita segura:
 * - só abas autorizadas recebem gravações (abas de fonte, backup, rascunho e fórmulas nunca);
 * - abas "somente atualização" não recebem linhas novas;
 * - IDs novos são estáveis e únicos.
 */
import { TABELAS_GRAVAVEIS, TABELAS_SOMENTE_ATUALIZACAO, TabelaBase } from './tabelas';

export const TABELAS_AUTORIZADAS_ESCRITA = TABELAS_GRAVAVEIS;

export function validarEscritaTabela(
  tabela: string,
  registro: Record<string, any>,
  tipo: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE'
): { valido: boolean; motivo?: string } {
  if (!tabela || typeof tabela !== 'string') return { valido: false, motivo: 'Nome de tabela não fornecido.' };
  const nome = tabela.toLowerCase().trim();
  if (/^(fonte|origem|backup|rascunho|_rascunho)/.test(nome) || /copia|temp|raw/.test(nome)) {
    return { valido: false, motivo: `A aba '${tabela}' é protegida e não pode ser alterada pelo app.` };
  }
  if (!TABELAS_GRAVAVEIS.includes(tabela as TabelaBase)) {
    return { valido: false, motivo: `A aba '${tabela}' é somente leitura no app.` };
  }
  if (tipo !== 'UPDATE' && TABELAS_SOMENTE_ATUALIZACAO.includes(tabela as TabelaBase)) {
    return { valido: false, motivo: `Na aba '${tabela}' o app só atualiza registros existentes.` };
  }
  if (!registro || typeof registro !== 'object') return { valido: false, motivo: 'Objeto de registro inválido.' };
  return { valido: true };
}

/** Gerador de IDs estáveis para novos registros. */
export function gerarIdEstavel(prefixo: string): string {
  const aleatorio = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefixo}_${Date.now().toString(36)}_${aleatorio}`;
}
