/**
 * Conta de serviço do Google (fluxo JWT-bearer). Usada pelo servidor quando quem age NÃO é a
 * professora com o próprio acesso à planilha: monitoras, leitura filtrada e a sincronização de metadados do Drive.
 *
 * GOOGLE_SERVICE_ACCOUNT_JSON (segredo do Worker) = o JSON da chave. A conta precisa ser compartilhada
 * como EDITORA na planilha e como LEITORA nas pastas/arquivos monitorados (somente metadados são consultados).
 */
export interface AmbienteContaServico { GOOGLE_SERVICE_ACCOUNT_JSON?: string; TOKEN_URL?: string }
export const ESCOPO_SHEETS = 'https://www.googleapis.com/auth/spreadsheets';
export const ESCOPO_DRIVE_METADADOS = 'https://www.googleapis.com/auth/drive.metadata.readonly';
const TOKEN_URL_PADRAO = 'https://oauth2.googleapis.com/token';
const loopback = (u: string) => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u);

export class ContaServicoIndisponivel extends Error {
  constructor(public readonly code: 'NAO_CONFIGURADA' | 'CHAVE_INVALIDA' | 'TOKEN_RECUSADO', message: string) { super(message); }
}
const b64url = (b: ArrayBuffer | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ''; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const cache = new Map<string, { token: string; ate: number }>();
export const limparCacheContaServico = () => cache.clear();

export function urlDoToken(env: AmbienteContaServico): string {
  return env.TOKEN_URL && loopback(env.TOKEN_URL) ? env.TOKEN_URL : TOKEN_URL_PADRAO;
}
async function importarChave(pem: string): Promise<CryptoKey> {
  const corpo = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  try { return await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(corpo), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']); }
  catch { throw new ContaServicoIndisponivel('CHAVE_INVALIDA', 'A chave da conta de serviço é inválida.'); }
}
/** Token de acesso da conta de serviço para os escopos pedidos (cache até 1 min antes de expirar). */
export async function tokenContaServico(env: AmbienteContaServico, escopos: string[], agoraMs = Date.now(), buscar: typeof fetch = fetch): Promise<string> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new ContaServicoIndisponivel('NAO_CONFIGURADA', 'Conta de serviço não configurada (GOOGLE_SERVICE_ACCOUNT_JSON).');
  const chaveCache = escopos.slice().sort().join(' ');
  const c = cache.get(chaveCache);
  if (c && c.ate > agoraMs + 60_000) return c.token;
  let cred: { client_email?: string; private_key?: string };
  try { cred = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON); } catch { throw new ContaServicoIndisponivel('CHAVE_INVALIDA', 'GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido.'); }
  if (!cred.client_email || !cred.private_key) throw new ContaServicoIndisponivel('CHAVE_INVALIDA', 'Faltam client_email/private_key na conta de serviço.');
  const url = urlDoToken(env), s = Math.floor(agoraMs / 1000);
  const cab = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: cred.client_email, scope: escopos.join(' '), aud: url, iat: s, exp: s + 3600 }));
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await importarChave(cred.private_key), new TextEncoder().encode(cab + '.' + claims));
  const r = await buscar(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cab + '.' + claims + '.' + b64url(assinatura) }), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new ContaServicoIndisponivel('TOKEN_RECUSADO', `O Google recusou a conta de serviço (HTTP ${r.status}).`);
  const j = await r.json() as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new ContaServicoIndisponivel('TOKEN_RECUSADO', 'Resposta do Google sem access_token.');
  cache.set(chaveCache, { token: j.access_token, ate: agoraMs + (j.expires_in ?? 3600) * 1000 });
  return j.access_token;
}
