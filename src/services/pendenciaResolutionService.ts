import type { Configuracao, ItemPendenciaOperacional } from '../types';

/** Resolução administrativa: não muda a situação acadêmica na origem. */
export function filtrarPendenciasResolvidas(
  pendencias: ItemPendenciaOperacional[],
  configuracoes: Configuracao[],
  periodoId: string,
): ItemPendenciaOperacional[] {
  const resolvidas = new Set(configuracoes
    .filter(c => c.periodo_id === periodoId && c.chave.startsWith('PENDENCIA_RESOLVIDA:'))
    .map(c => c.chave.slice('PENDENCIA_RESOLVIDA:'.length)));
  return pendencias.filter(item => !resolvidas.has(item.id));
}
