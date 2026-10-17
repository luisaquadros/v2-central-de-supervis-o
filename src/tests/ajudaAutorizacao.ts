/** Apoio de testes: par de chaves RSA, JWKS e tokens de ID assinados no formato do Firebase. */
import { PROJETO_FIREBASE_PADRAO, URL_JWKS_PADRAO } from '../server/autorizacao';
const b64 = (b: ArrayBuffer | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export async function criarEmissor(kid = 'chave-teste-1') {
  const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', par.publicKey)), kid, alg: 'RS256', use: 'sig' };
  const assinar = async (claims: Record<string, unknown>, cab: Record<string, unknown> = {}) => {
    const h = b64(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT', ...cab })), c = b64(JSON.stringify(claims));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, new TextEncoder().encode(h + '.' + c));
    return h + '.' + c + '.' + b64(sig);
  };
  const token = (email: string, extra: Record<string, unknown> = {}, agora = Date.now(), cab: Record<string, unknown> = {}) => {
    const s = Math.floor(agora / 1000);
    return assinar({ iss: `https://securetoken.google.com/${PROJETO_FIREBASE_PADRAO}`, aud: PROJETO_FIREBASE_PADRAO, sub: 'uid-' + email,
      iat: s - 10, exp: s + 3000, email, email_verified: true, ...extra }, cab);
  };
  return { jwks: { keys: [jwk] }, token, assinar };
}
/** Resposta do JWKS para o fetch simulado. */
export const ehJwks = (url: string) => url === URL_JWKS_PADRAO || /\/jwk(s)?(\?|$)/.test(url);
