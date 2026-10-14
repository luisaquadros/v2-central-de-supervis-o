/**
 * Criação ADITIVA das abas da avaliação. Nunca altera, apaga ou reescreve abas existentes:
 * só adiciona abas que não existem e escreve a linha de cabeçalho delas. Idempotente.
 * Aba existente com cabeçalho diferente é apenas relatada (divergente); nada é modificado.
 */
import { ABAS_AVALIACAO, NOMES_ABAS_AVALIACAO, diagnosticarEstrutura, type NomeAbaAvaliacao } from '../services/estruturaAvaliacao';

export type ChamarGoogle = (url: string, init?: RequestInit) => Promise<any>;
const quoted = (name: string) => "'" + name.replaceAll("'", "''") + "'";

export interface RelatorioEstrutura {
  criadas: NomeAbaAvaliacao[];
  existentes: NomeAbaAvaliacao[];
  divergentes: { aba: NomeAbaAvaliacao; faltando: string[] }[];
}

/** Lê os cabeçalhos reais (somente leitura). */
export async function lerCabecalhos(urlPlanilha: string, chamar: ChamarGoogle): Promise<Partial<Record<string, string[]>>> {
  const meta = await chamar(urlPlanilha + '?fields=' + encodeURIComponent('sheets(properties(title))'));
  const titulos: string[] = (meta.sheets || []).map((s: any) => s.properties.title);
  const presentes = NOMES_ABAS_AVALIACAO.filter(n => titulos.includes(n));
  const out: Partial<Record<string, string[]>> = {};
  if (!presentes.length) return out;
  const r = await chamar(urlPlanilha + '/values:batchGet?' + presentes.map(n => 'ranges=' + encodeURIComponent(quoted(n) + '!1:1')).join('&'));
  presentes.forEach((n, i) => { out[n] = ((r.valueRanges?.[i]?.values?.[0]) || []).map((x: unknown) => String(x).trim()); });
  return out;
}

export async function criarEstruturaAvaliacao(urlPlanilha: string, chamar: ChamarGoogle): Promise<RelatorioEstrutura> {
  const diag = diagnosticarEstrutura(await lerCabecalhos(urlPlanilha, chamar));
  const rel: RelatorioEstrutura = { criadas: [], existentes: [], divergentes: [] };
  for (const d of diag) {
    if (d.situacao === 'ok') { rel.existentes.push(d.aba); continue; }
    if (d.situacao === 'colunas_faltando') { rel.divergentes.push({ aba: d.aba, faltando: d.faltando }); continue; }
    const colunas = [...ABAS_AVALIACAO[d.aba].colunas];
    await chamar(urlPlanilha + ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: d.aba, gridProperties: { rowCount: 1000, columnCount: colunas.length, frozenRowCount: 1 } } } }] }),
    });
    await chamar(urlPlanilha + '/values/' + encodeURIComponent(quoted(d.aba) + '!A1') + '?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [colunas] }),
    });
    rel.criadas.push(d.aba);
  }
  return rel;
}
