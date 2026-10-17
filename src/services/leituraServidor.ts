import { chamarServidor, type PerfilServidor } from './escritaCoordenadaService';
import { TABELAS_NORMALIZADAS, montarResultadoLeitura, normalizarLinhasDaAba, parseSheetRowsToObjects, type ResultadoLeituraPlanilha } from './googleSheetsService';
import { tabelaLegivelPor, type Perfil } from '../server/acessos';

/**
 * Leitura para perfis que NÃO leem a planilha diretamente (monitoras): o servidor lê com a conta de serviço,
 * entrega só as tabelas e linhas da turma delegada e omite colunas sensíveis.
 */
export async function carregarViaServidor(perfil: PerfilServidor): Promise<ResultadoLeituraPlanilha> {
  const p = perfil as unknown as Perfil;
  const pedidas = TABELAS_NORMALIZADAS.filter(t => tabelaLegivelPor(p, t));
  const restritas = TABELAS_NORMALIZADAS.filter(t => !pedidas.includes(t));
  const r = await chamarServidor('/api/leitura?tabelas=' + pedidas.join(','));
  if (r.status !== 200 || !r.corpo?.ok) throw new Error(r.corpo?.message || `Leitura pelo servidor falhou (${r.status}).`);
  const mapa: Record<string, any[]> = {};
  for (const t of pedidas) {
    const values = r.corpo.tabelas?.[t]?.values;
    if (Array.isArray(values)) mapa[t] = normalizarLinhasDaAba(t, parseSheetRowsToObjects(values));
  }
  return montarResultadoLeitura(mapa, [], restritas);
}
