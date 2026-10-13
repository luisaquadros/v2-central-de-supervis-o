import { TABELAS_CRITICAS } from '../server/coordenacaoCritica';
import type { SyncQueueItem } from './indexedDbService';
import { getAccessToken, auth } from './googleSheetsService';

/** Nenhuma escrita crítica pode contornar o coordenador do servidor. */
export async function gravarCriticoCoordenado(item: SyncQueueItem): Promise<void> {
  if(!TABELAS_CRITICAS.has(item.tabela))throw new Error('Tabela não protegida pelo coordenador.');
  const tipoEfetivo = item.tipo==='INSERT' && item.versao_base ? 'UPDATE' : item.tipo;
  if(tipoEfetivo!=='INSERT' && item.versao_base==null)
    throw new Error('CONFLITO_VERSAO: edição antiga sem versão original; registro preservado para revisão manual.');
  const token=await getAccessToken();
  if(!token)throw new Error('Sessão Google expirada.');
  const res=await fetch('/api/critical-write',{
    method:'POST',
    headers:{'Authorization': 'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({
      tabela:item.tabela,tipo:tipoEfetivo,registro:item.payload,
      esperado:item.versao_base??null,operacaoId:item.id,usuario:auth.currentUser?.email??''
    }),
    signal:AbortSignal.timeout(30000)
  });
  const data=await res.json().catch(()=>({ok:false,message:'Resposta inválida do coordenador de escrita.'}));
  if(res.status===409){
    throw new Error('CONFLITO_VERSAO: '+(data.message||'A versão remota é diferente da edição local.'));
  }
  if(!res.ok||!data.ok)
    throw new Error(data.message||'Falha na gravação coordenada. A alteração permanece no dispositivo.');
}
