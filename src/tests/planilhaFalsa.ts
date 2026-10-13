/**
 * Planilha Google simulada em memória para os testes (sem rede, sem dados reais).
 * Responde como a API v4 com UNFORMATTED_VALUE: números e booleanos chegam com o tipo original.
 * Células cujo texto começa com "=" representam fórmulas e permitem verificar que não foram tocadas.
 */
export interface AbaFalsa { sheetId: number; rows: unknown[][]; columnCount: number }
export interface ChamadaFalsa { method: string; url: string; body: any }

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;

function colunaParaIndice(letras: string): number {
  return letras.split('').reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
}

function parseRange(range: string): { titulo: string; col: number; linha: number | null } {
  const m = /^'((?:[^']|'')+)'(?:!([A-Z]+)(\d+)?)?/.exec(range);
  if (!m) throw new Error('Range inválido no teste: ' + range);
  return { titulo: m[1].replace(/''/g, "'"), col: m[2] ? colunaParaIndice(m[2]) : 0, linha: m[3] ? Number(m[3]) : null };
}

export function criarPlanilhaFalsa(inicial: Record<string, unknown[][]>, exibidos: Record<string, unknown[][]> = {}) {
  let proximoId = 1;
  const abas = new Map<string, AbaFalsa>();
  for (const [titulo, rows] of Object.entries(inicial)) {
    abas.set(titulo, { sheetId: proximoId++, rows: rows.map(r => [...r]), columnCount: 26 });
  }
  const chamadas: ChamadaFalsa[] = [];

  const aba = (titulo: string) => {
    const a = abas.get(titulo);
    if (!a) throw new Error('Aba inexistente no teste: ' + titulo);
    return a;
  };

  const fetchFalso = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    const method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const caminho = decodeURIComponent(u.pathname);
    chamadas.push({ method, url: decodeURIComponent(String(url)), body });

    if (method === 'GET' && u.searchParams.get('fields')) {
      return ok({ sheets: [...abas].map(([title, a]) => ({ properties: { title, sheetId: a.sheetId, gridProperties: { columnCount: a.columnCount } } })) });
    }
    if (method === 'GET' && caminho.endsWith('/values:batchGet')) {
      const formatado = u.searchParams.get('valueRenderOption') === 'FORMATTED_VALUE';
      return ok({ valueRanges: u.searchParams.getAll('ranges').map(r => {
        const titulo = parseRange(r).titulo;
        return { range: r, values: formatado && exibidos[titulo] ? exibidos[titulo] : aba(titulo).rows };
      }) });
    }
    if (method === 'GET' && caminho.includes('/values/')) {
      return ok({ values: aba(parseRange(caminho.split('/values/')[1]).titulo).rows });
    }
    if (method === 'POST' && caminho.endsWith('/values:batchUpdate')) {
      for (const d of body.data) {
        const { titulo, col, linha } = parseRange(d.range);
        const a = aba(titulo);
        d.values.forEach((valoresLinha: unknown[], i: number) => {
          const idx = (linha ?? 1) - 1 + i;
          while (a.rows.length <= idx) a.rows.push([]);
          valoresLinha.forEach((v, j) => {
            if (col + j >= a.columnCount) throw new Error('Escrita além da grade da aba');
            a.rows[idx][col + j] = v;
          });
        });
      }
      return ok({});
    }
    if (method === 'POST' && caminho.endsWith(':append')) {
      const a = aba(parseRange(caminho.split('/values/')[1]).titulo);
      a.rows.push(...body.values.map((r: unknown[]) => [...r]));
      return ok({ updates: { updatedRows: body.values.length } });
    }
    if (method === 'POST' && caminho.endsWith(':batchUpdate')) {
      const replies: unknown[] = [];
      for (const r of body.requests) {
        if (r.addSheet) {
          const title = r.addSheet.properties.title;
          abas.set(title, { sheetId: proximoId++, rows: [], columnCount: r.addSheet.properties.gridProperties?.columnCount ?? 26 });
          replies.push({ addSheet: { properties: { title, sheetId: abas.get(title)!.sheetId } } });
        } else if (r.appendDimension) {
          const a = [...abas.values()].find(x => x.sheetId === r.appendDimension.sheetId)!;
          a.columnCount += r.appendDimension.length;
        } else if (r.deleteDimension) {
          const { sheetId, startIndex, endIndex } = r.deleteDimension.range;
          const a = [...abas.values()].find(x => x.sheetId === sheetId)!;
          a.rows.splice(startIndex, endIndex - startIndex);
        }
      }
      return ok({ replies });
    }
    throw new Error(`Requisição inesperada no teste: ${method} ${caminho}`);
  }) as typeof fetch;

  return { abas, chamadas, fetchFalso, linhas: (titulo: string) => aba(titulo).rows };
}
