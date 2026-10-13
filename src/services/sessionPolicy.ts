/** Sessão de acesso ao cache acadêmico no dispositivo (não é OAuth). */
const KEY = 'cs_sessao_verificada_v1';
export const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;
type SessionMarker = { uid: string; inicio: number };
export function lerSessaoAutorizada(uid: string, agora = Date.now()): boolean {
  if (!uid || typeof localStorage === 'undefined') return false;
  try {
    const sessao: SessionMarker = JSON.parse(localStorage.getItem(KEY) || 'null');
    return !!sessao && sessao.uid === uid && Number.isFinite(sessao.inicio) &&
      sessao.inicio <= agora && agora - sessao.inicio < SEIS_HORAS_MS;
  } catch { return false; }
}
/** A sessão é registrada só após validação REAL de acesso ao Sheets. */
export function registrarSessaoAutorizada(uid: string, agora = Date.now()): void {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    if (!lerSessaoAutorizada(uid, agora)) {
      localStorage.setItem(KEY, JSON.stringify({ uid, inicio: agora }));
    }
  } catch { /* navegação privada: login continua funcional somente nesta aba */ }
}
export function encerrarSessaoAutorizada(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); } catch {}
}
