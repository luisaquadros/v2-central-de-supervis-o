/**
 * Ambiente de teste de ponta a ponta: planilha simulada (Sheets API v4) + Drive simulado + JWKS,
 * atrás do handler REAL do Worker (autorização, coordenador e log). Sem rede e sem dados reais.
 */
import worker, { WriteCoordinator } from '../server/worker';
import { definirProvedorIdToken } from '../services/escritaCoordenadaService';
import { criarEmissor, ehJwks } from './ajudaAutorizacao';
import { limparCacheJwks } from '../server/autorizacao';

export type Abas = Record<string, any[][]>;
export interface OpcoesAmbiente {
  abas: Abas;
  env?: Record<string, unknown>;
  /** Respostas do Drive por arquivo_id: [status HTTP, corpo]. */
  drive?: Record<string, [number, Record<string, unknown>]>;
  /** Falhas injetadas: nome da aba → status HTTP em leituras/gravações. */
  falhas?: Record<string, number>;
}
const ok = (d: unknown, status = 200) => ({ ok: status < 400, status, json: async () => d, text: async () => JSON.stringify(d) }) as Response;

export async function criarAmbiente(op: OpcoesAmbiente) {
  limparCacheJwks(); // cada ambiente tem o seu par de chaves
  const emissor = await criarEmissor();
  const abas = op.abas;
  const store = new Map<string, unknown>();
  const coord = new WriteCoordinator({ storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => { store.set(k, v); } } } as any,
    { ...(op.env ?? {}) } as any);
  const envWorker: any = { ADMIN_EMAILS: 'professora@exemplo.com', ASSETS: { fetch: async () => new Response('') },
    WRITE_COORDINATOR: { idFromName: () => 'x', get: () => ({ fetch: (rq: Request) => coord.fetch(rq) }) }, ...(op.env ?? {}) };
  const chamadas: { metodo: string; url: string; auth: string | null }[] = [];
  const driveConsultas: string[] = [];
  const velho = globalThis.fetch;
  const falhas = op.falhas ?? {};
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = String(input), m = (init?.method || 'GET').toUpperCase();
    const auth = new Headers(init?.headers as any).get('Authorization');
    if (ehJwks(url)) return ok(emissor.jwks);
    if (url.includes('/api/')) {
      const r = await worker.fetch(new Request('https://app.exemplo' + new URL(url, 'https://app.exemplo').pathname, { method: m, headers: init?.headers as any, body: init?.body as any }), envWorker);
      return { ok: r.ok, status: r.status, json: async () => r.json(), text: async () => r.text() } as Response;
    }
    if (url.includes('oauth2.googleapis.com/token') || url.includes('/token')) {
      chamadas.push({ metodo: m, url, auth });
      return ok({ access_token: 'token-conta-servico', expires_in: 3600, token_type: 'Bearer' });
    }
    if (url.includes('/drive/v3/files/')) {
      const id = decodeURIComponent(url.split('/drive/v3/files/')[1].split('?')[0]);
      driveConsultas.push(url);
      const r = op.drive?.[id];
      if (!r) return ok({ error: { code: 404 } }, 404);
      return ok(r[1], r[0]);
    }
    if (!url.includes('sheets.googleapis.com') && !url.includes('/v4/spreadsheets')) throw new Error('requisição inesperada: ' + m + ' ' + url);
    chamadas.push({ metodo: m, url, auth });
    const dec = decodeURIComponent(url);
    const aba = dec.match(/values\/'([^'!]+)'/)?.[1];
    if (aba && falhas[aba]) return ok({ error: {} }, falhas[aba]);
    if (url.includes('fields=sheets')) return ok({ sheets: Object.keys(abas).map(t => ({ properties: { title: t, sheetId: 1 } })) });
    if (url.endsWith(':batchUpdate') && !url.includes('/values:') && m === 'POST') {
      const a = JSON.parse(String(init!.body)).requests?.[0]?.addSheet; if (a) abas[a.properties.title] = []; return ok({});
    }
    if (url.includes('/values:batchUpdate')) {
      for (const p of JSON.parse(String(init!.body)).data) {
        const [, col, row] = p.range.match(/!([A-Z]+)(\d+)$/)!; const t = p.range.match(/^'([^']+)'/)![1];
        abas[t][Number(row) - 1][col.split('').reduce((n: number, c: string) => n * 26 + c.charCodeAt(0) - 64, 0) - 1] = p.values[0][0];
      } return ok({});
    }
    if (m === 'PUT' && aba) { abas[aba][0] = JSON.parse(String(init!.body)).values[0]; return ok({}); }
    if (url.includes(':append?') && aba) { (abas[aba] ??= []).push(JSON.parse(String(init!.body)).values[0]); return ok({}); }
    if (aba) { if (!abas[aba]) return ok({ error: {} }, 400); return ok({ values: abas[aba] }); }
    throw new Error('requisição inesperada: ' + m + ' ' + url);
  }) as typeof fetch;
  const entrar = (email = 'professora@exemplo.com') => definirProvedorIdToken(() => emissor.token(email));
  entrar();
  return { abas, emissor, store, coord, envWorker, chamadas, driveConsultas, entrar, worker,
    restaurar: () => { globalThis.fetch = velho; } };
}
