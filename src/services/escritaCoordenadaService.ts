import { TABELAS_CRITICAS } from '../server/coordenacaoCritica';
import type { SyncQueueItem } from './indexedDbService';
import { getAccessToken, auth } from './googleSheetsService';

/** Permite aos testes fornecer o token de identidade sem Firebase real. */
let provedorIdToken: () => Promise<string | undefined> = async () => auth.currentUser?.getIdToken();
export const definirProvedorIdToken = (f: () => Promise<string | undefined>) => { provedorIdToken = f; };

/** Nenhuma escrita crítica pode contornar o coordenador do servidor. */
export async function gravarCriticoCoordenado(item: SyncQueueItem): Promise<void> {
  if(!TABELAS_CRITICAS.has(item.tabela))throw new Error('Tabela não protegida pelo coordenador.');
  const tipoEfetivo = item.tipo==='INSERT' && item.versao_base ? 'UPDATE' : item.tipo;
  if(tipoEfetivo!=='INSERT' && item.versao_base==null)
    throw new Error('CONFLITO_VERSAO: edição antiga sem versão original; registro preservado para revisão manual.');
  const token=await getAccessToken();
  const idToken=await provedorIdToken();
  if(!idToken)throw new Error('Sessão expirada: entre novamente com a conta Google.');
  if(!token)throw new Error('Sessão Google expirada.');
  const res=await fetch('/api/critical-write',{
    method:'POST',
    headers:{'Authorization': 'Bearer '+token,'X-Firebase-Id-Token':idToken,'Content-Type':'application/json'},
    body:JSON.stringify({
      tabela:item.tabela,tipo:tipoEfetivo,registro:item.payload,
      esperado:item.versao_base??null,operacaoId:item.id
    }),
    signal:AbortSignal.timeout(30000)
  });
  const data=await res.json().catch(()=>({ok:false,message:'Resposta inválida do coordenador de escrita.'}));
  if(res.status===409){
    throw new Error('CONFLITO_VERSAO: '+(data.message||'A versão remota é diferente da edição local.')+(Array.isArray(data.campos)&&data.campos.length?' Campos em conflito: '+data.campos.join(', ')+'.':''));
  }
  if(!res.ok||!data.ok)
    throw new Error(data.message||'Falha na gravação coordenada. A alteração permanece no dispositivo.');
}

export interface PerfilServidor { papel: 'PROFESSORA_ADMIN' | 'MONITORA'; email: string; turmas: string[]; operacoes: string[]; avisos: string[]; viaContaServico?: boolean }
export type EstadoAcesso =
  | { estado: 'AUTORIZADO'; email: string; perfil: PerfilServidor }
  | { estado: 'SEM_PERMISSAO' | 'NAO_CONFIGURADO' | 'SESSAO_INVALIDA' | 'INDISPONIVEL'; mensagem: string };

let acessoCache: { em: number; estado: EstadoAcesso } | null = null;
export const limparCachePerfil = () => { acessoCache = null; };

/** Pergunta ao servidor quem é esta conta e o que ela pode. A decisão é do servidor; a tela só mostra o resultado. */
export async function verificarAcessoEscrita(forcar = false): Promise<EstadoAcesso> {
  if (!forcar && acessoCache && Date.now() - acessoCache.em < 10 * 60_000 && acessoCache.estado.estado === 'AUTORIZADO') return acessoCache.estado;
  const estado = await consultarAcesso();
  if (estado.estado === 'AUTORIZADO') acessoCache = { em: Date.now(), estado };
  return estado;
}
/** Perfil verificado no servidor, ou null se indisponível (offline, sem permissão, não configurado). */
export async function obterPerfilServidor(): Promise<PerfilServidor | null> {
  const e = await verificarAcessoEscrita();
  return e.estado === 'AUTORIZADO' ? e.perfil : null;
}
async function consultarAcesso(): Promise<EstadoAcesso> {
  try {
    const idToken = await provedorIdToken();
    if (!idToken) return { estado: 'SESSAO_INVALIDA', mensagem: 'Entre novamente com a conta Google.' };
    const res = await fetch('/api/acesso', { headers: { 'X-Firebase-Id-Token': idToken }, signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { estado: 'AUTORIZADO', email: String(data.email), perfil: { papel: data.papel, email: String(data.email), turmas: data.turmas ?? [], operacoes: data.operacoes ?? [], avisos: data.avisos ?? [], viaContaServico: data.viaContaServico === true } };
    const mensagem = String(data.message || 'Não foi possível verificar o acesso.');
    if (res.status === 403) return { estado: 'SEM_PERMISSAO', mensagem };
    if (res.status === 503) return { estado: 'NAO_CONFIGURADO', mensagem };
    if (res.status === 401) return { estado: 'SESSAO_INVALIDA', mensagem };
    return { estado: 'INDISPONIVEL', mensagem };
  } catch { return { estado: 'INDISPONIVEL', mensagem: 'Sem conexão com o servidor de gravação.' }; }
}

/** Chamada autenticada às demais rotas do Worker (leitura filtrada, sincronização de documentos). */
export async function chamarServidor(caminho: string, metodo: 'GET' | 'POST' = 'GET'): Promise<{ status: number; corpo: any }> {
  const idToken = await provedorIdToken();
  if (!idToken) throw new Error('Sessão expirada: entre novamente com a conta Google.');
  const res = await fetch(caminho, { method: metodo, headers: { 'X-Firebase-Id-Token': idToken }, signal: AbortSignal.timeout(60000) });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}

/** Estrutura aditiva da avaliação (somente professora): GET = diagnóstico; POST = criação (exige confirmação e checksum de backup). */
export async function chamarEstruturaAvaliacao(metodo: 'GET' | 'POST', corpo?: unknown): Promise<{ status: number; corpo: any }> {
  const idToken = await provedorIdToken();
  const token = await getAccessToken();
  if (!idToken) throw new Error('Sessão expirada: entre novamente com a conta Google.');
  if (!token) throw new Error('Sessão Google expirada.');
  const res = await fetch('/api/estrutura/avaliacao', {
    method: metodo,
    headers: { Authorization: 'Bearer ' + token, 'X-Firebase-Id-Token': idToken, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(60000),
  });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}
