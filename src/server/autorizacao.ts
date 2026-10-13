/**
 * Autorização no servidor. A identidade vem do token de ID do Firebase, verificado aqui
 * (assinatura RS256 com as chaves públicas do Google, emissor, público, validade e e-mail verificado).
 * O e-mail enviado "por fora" pelo aplicativo nunca é usado. Sem lista de administradores configurada,
 * nenhuma gravação é aceita (falha fechada), conforme D4: acesso restrito à professora administradora.
 */
export const PROJETO_FIREBASE_PADRAO = 'gen-lang-client-0003708748';
export const URL_JWKS_PADRAO = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export interface AmbienteAutorizacao {
  ADMIN_EMAILS?: string;
  FIREBASE_PROJECT_ID?: string;
  /** Somente para testes locais: precisa ser loopback (http://127.0.0.1 ou http://localhost). */
  JWKS_URL?: string;
}
export type ResultadoAutorizacao =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403 | 503; code: 'ACESSO_NAO_CONFIGURADO' | 'TOKEN_AUSENTE' | 'TOKEN_INVALIDO' | 'NAO_AUTORIZADO'; message: string };

const loopback = (u: string) => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u);
export function urlJwks(env: AmbienteAutorizacao): string {
  return env.JWKS_URL && loopback(env.JWKS_URL) ? env.JWKS_URL : URL_JWKS_PADRAO;
}
export function listaDeAdministradores(env: AmbienteAutorizacao): string[] {
  return (env.ADMIN_EMAILS ?? '').split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+$/.test(e));
}

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
const json = (s: string) => JSON.parse(new TextDecoder().decode(b64url(s)));

let cacheJwks: { url: string; ate: number; buscadoEm: number; chaves: { kid: string; [k: string]: unknown }[] } | null = null;
export function limparCacheJwks() { cacheJwks = null; }
const INTERVALO_MIN_REBUSCA_MS = 60 * 1000;
/**
 * Chaves públicas com cache de 1 h. Se o token traz um `kid` que o cache não conhece (rotação de chaves do Google),
 * busca de novo — no máximo uma vez por minuto, para que tokens forjados não gerem uma chamada externa por requisição.
 */
async function obterChaves(url: string, agora: number, buscar: typeof fetch, kid: string) {
  const valido = cacheJwks && cacheJwks.url === url && cacheJwks.ate > agora;
  if (valido && (cacheJwks!.chaves.some(k => k.kid === kid) || agora - cacheJwks!.buscadoEm < INTERVALO_MIN_REBUSCA_MS)) return cacheJwks!.chaves;
  const r = await buscar(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('JWKS indisponível');
  const chaves = ((await r.json()) as { keys: { kid: string }[] }).keys;
  cacheJwks = { url, ate: agora + 60 * 60 * 1000, buscadoEm: agora, chaves };
  return chaves;
}

/** Verifica o token de ID. Lança Error com mensagem curta e sem dados do token. */
export async function verificarIdTokenFirebase(
  token: string, env: AmbienteAutorizacao, agoraMs = Date.now(), buscar: typeof fetch = fetch,
): Promise<{ email: string; uid: string }> {
  const partes = token.split('.');
  if (partes.length !== 3) throw new Error('formato');
  let cab: { alg?: string; kid?: string }, claims: Record<string, any>;
  try { cab = json(partes[0]); claims = json(partes[1]); } catch { throw new Error('formato'); }
  if (cab.alg !== 'RS256' || !cab.kid) throw new Error('algoritmo');
  const projeto = env.FIREBASE_PROJECT_ID || PROJETO_FIREBASE_PADRAO;
  const agora = Math.floor(agoraMs / 1000);
  if (claims.aud !== projeto || claims.iss !== `https://securetoken.google.com/${projeto}`) throw new Error('emissor');
  if (typeof claims.exp !== 'number' || claims.exp <= agora) throw new Error('expirado');
  if (typeof claims.iat !== 'number' || claims.iat > agora + 300) throw new Error('emitido no futuro');
  if (!claims.sub || typeof claims.sub !== 'string') throw new Error('sem sub');
  const chaves = await obterChaves(urlJwks(env), agoraMs, buscar, cab.kid);
  const jwk = chaves.find(k => k.kid === cab.kid);
  if (!jwk) throw new Error('chave desconhecida');
  const chave = await crypto.subtle.importKey('jwk', jwk as JsonWebKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valido = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, b64url(partes[2]), new TextEncoder().encode(partes[0] + '.' + partes[1]));
  if (!valido) throw new Error('assinatura');
  if (claims.email_verified !== true || typeof claims.email !== 'string') throw new Error('e-mail não verificado');
  return { email: claims.email.toLowerCase(), uid: claims.sub };
}

export async function autorizarAdministrador(
  idToken: string | null, env: AmbienteAutorizacao, agoraMs = Date.now(), buscar: typeof fetch = fetch,
): Promise<ResultadoAutorizacao> {
  const admins = listaDeAdministradores(env);
  if (!admins.length) return { ok: false, status: 503, code: 'ACESSO_NAO_CONFIGURADO',
    message: 'Acesso de gravação não configurado: defina ADMIN_EMAILS no Worker. Enquanto isso nenhuma gravação é aceita.' };
  if (!idToken) return { ok: false, status: 401, code: 'TOKEN_AUSENTE', message: 'Identidade não informada. Entre novamente com a conta Google.' };
  let id: { email: string };
  try { id = await verificarIdTokenFirebase(idToken, env, agoraMs, buscar); }
  catch { return { ok: false, status: 401, code: 'TOKEN_INVALIDO', message: 'Identidade inválida ou expirada. Entre novamente com a conta Google.' }; }
  if (!admins.includes(id.email)) return { ok: false, status: 403, code: 'NAO_AUTORIZADO', message: 'Esta conta não tem permissão de gravação.' };
  return { ok: true, email: id.email };
}
