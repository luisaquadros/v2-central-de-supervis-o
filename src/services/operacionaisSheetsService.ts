/**
 * Armazenamento de itens operacionais em linhas individuais da tabela configuracoes.
 * Não cria mais um backend ou outra fonte de verdade; cada item tem chave estável.
 * A exclusão é tombstone, impedindo que um cache local antigo o ressuscite.
 */
import type { Configuracao } from '../types';

export type TipoOperacional = 'CAIXA_ENTRADA' | 'FILA_PROFESSORA' | 'FILA_SUPERVISAO';
const PREFIX = 'APP_OPERACIONAL_V1:';
const categorias: readonly TipoOperacional[] = ['CAIXA_ENTRADA','FILA_PROFESSORA','FILA_SUPERVISAO'];

export function chaveItemOperacional(tipo: TipoOperacional, id: string): string {
  if (!categorias.includes(tipo) || !id || id.length > 180 || !/^[A-Za-z0-9_.:-]+$/.test(id)) {
    throw new Error('Identificador operacional inválido.');
  }
  return PREFIX + tipo + ':' + id;
}

export function prepararRegistroOperacional<T extends {id:string}>(
  tipo: TipoOperacional, item: T,
  periodoId: string, configuracaoAnterior?: Configuracao,
  excluido = false,
): Configuracao {
  return {
    configuracao_id: configuracaoAnterior?.configuracao_id ||
      'op-' + tipo.toLowerCase() + '-' + item.id,
    chave: chaveItemOperacional(tipo, item.id),
    valor: JSON.stringify({ registro: item, excluido }),
    periodo_id: configuracaoAnterior?.periodo_id || periodoId,
    turma_id: configuracaoAnterior?.turma_id || (item as any).turma_id || '',
    disciplina_id: configuracaoAnterior?.disciplina_id || '',
  };
}

export function registrosOperacionais<T extends {id:string}>(
  configuracoes: Configuracao[], tipo: TipoOperacional,
): Map<string,{item:T;excluido:boolean}> {
  const encontrados = new Map<string,{item:T;excluido:boolean}>();
  const prefix = PREFIX + tipo + ':';
  for (const config of configuracoes) {
    if (!config.chave.startsWith(prefix)) continue;
    try {
      const data = JSON.parse(String(config.valor || ''));
      const registro = data?.registro as T;
      const id = config.chave.slice(prefix.length);
      if (!registro || typeof registro !== 'object' || registro.id !== id) continue;
      encontrados.set(id,{item:registro,excluido:data.excluido===true});
    } catch {
      // Um valor legado inválido não pode apagar a cópia válida do dispositivo.
    }
  }
  return encontrados;
}

export function combinarOperacionais<T extends {id:string}>(
  locais: T[], configuracoes: Configuracao[], tipo: TipoOperacional,
): T[] {
  const remotos = registrosOperacionais<T>(configuracoes,tipo);
  const itens = new Map(locais.map(i=>[i.id,i]));
  for (const [id,{item,excluido}] of remotos) {
    if (excluido) itens.delete(id);
    else itens.set(id,item); // Versão oficial prevalece sobre o cache.
  }
  return [...itens.values()];
}

export function contarLegadosLocais<T extends {id:string}>(
  locais: T[], configuracoes: Configuracao[], tipo: TipoOperacional,
): number {
  const idsRemotos = registrosOperacionais<T>(configuracoes,tipo);
  return locais.filter(x=>!idsRemotos.has(x.id)).length;
}
