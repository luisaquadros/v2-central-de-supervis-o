import type {planejarPeriodo} from './semestreService';
import {recordIdentity} from './recordIdentity';
import {valorComparavelCampo} from '../server/coordenacaoCritica';

export interface RoteiroPeriodo {
  tipo:'CRIACAO_PERIODO';usuario_uid:string;periodo_id:string;nome:string;criado_em:string;
  estado:'PENDENTE'|'CONCLUIDO';
  passos:Array<{tabela:string;registro:Record<string,unknown>;estado:'NOVO'|'TENTADO'|'CONFIRMADO'}>;
}
/** IDs e modelo são fixados antes do primeiro envio. Nenhum dado de estudante é aceito. */
export function criarRoteiroPeriodo(plano:ReturnType<typeof planejarPeriodo>,usuario:string):RoteiroPeriodo {
 const colecoes:Array<[string,unknown[]]>=[['periodos',[plano.periodo]],['turmas',plano.turmas],['criterios_avaliacao',plano.criterios],['horarios_turma',plano.horarios],['marcos_academicos',plano.marcos],['rubricas_avaliacao',plano.rubricas],['config_avaliacao',plano.configuracoes]];
 return {tipo:'CRIACAO_PERIODO',usuario_uid:usuario,periodo_id:plano.periodo.periodo_id,nome:plano.periodo.nome,criado_em:new Date().toISOString(),estado:'PENDENTE',passos:colecoes.flatMap(([tabela,registros])=>registros.map(registro=>({tabela,registro:JSON.parse(JSON.stringify(registro)),estado:'NOVO' as const})))};
}
export async function executarRoteiroPeriodo(roteiro:RoteiroPeriodo,deps:{
 salvarCheckpoint:(r:RoteiroPeriodo)=>Promise<void>;
 gravar:(tabela:string,registro:Record<string,unknown>)=>Promise<{gravadoOnline:boolean}>;
 aplicarLocal?:(tabela:string,registro:Record<string,unknown>)=>void;
 /** Snapshot autenticado novo; cache local nunca confirma um envio ambíguo. */
 remoto?:Record<string,Record<string,unknown>[]>;
}):Promise<void>{
 const permitidas=new Set(['periodos','turmas','criterios_avaliacao','horarios_turma','marcos_academicos','rubricas_avaliacao','config_avaliacao']);
 if(roteiro.tipo!=='CRIACAO_PERIODO'||!roteiro.usuario_uid||!Array.isArray(roteiro.passos)||!roteiro.passos.length)throw new Error('Checkpoint de criação inválido.');
 const vistos=new Set<string>();
 for(const p of roteiro.passos){
   if(!permitidas.has(p.tabela)||!['NOVO','TENTADO','CONFIRMADO'].includes(p.estado))throw new Error('Checkpoint contém dados que não pertencem ao modelo de semestre.');
   const id=recordIdentity(p.tabela,p.registro),chave=p.tabela+'|'+id;
   if(!id||vistos.has(chave))throw new Error('Checkpoint contém identificadores ausentes ou duplicados.');
   vistos.add(chave);
 }
 if(roteiro.passos.filter(p=>p.tabela==='periodos').length!==1||roteiro.passos[0].tabela!=='periodos'||roteiro.passos[0].registro.periodo_id!==roteiro.periodo_id)throw new Error('Checkpoint não corresponde ao período.');
 await deps.salvarCheckpoint(roteiro);
 for(const passo of roteiro.passos){
  if(passo.estado==='CONFIRMADO')continue;
  if(passo.estado==='TENTADO'){
   const rows=deps.remoto?.[passo.tabela];
   if(!Array.isArray(rows))throw new Error('Reconecte e confira a base oficial antes de retomar uma criação interrompida.');
   const id=recordIdentity(passo.tabela,passo.registro),encontrados=rows.filter(r=>recordIdentity(passo.tabela,r)===id);
   if(encontrados.length>1)throw new Error('IDs duplicados na base oficial. Retomada bloqueada para conferência.');
   if(encontrados.length){
    const registro=encontrados[0];
    if(!Object.keys(passo.registro).filter(k=>valorComparavelCampo(passo.tabela,k,passo.registro[k])!=='').every(k=>valorComparavelCampo(passo.tabela,k,passo.registro[k])===valorComparavelCampo(passo.tabela,k,registro[k])))throw new Error('A estrutura do período mudou no servidor. Revise antes de retomar.');
    passo.estado='CONFIRMADO';deps.aplicarLocal?.(passo.tabela,registro);await deps.salvarCheckpoint(roteiro);continue;
   }
  }
  passo.estado='TENTADO';await deps.salvarCheckpoint(roteiro);
  const resultado=await deps.gravar(passo.tabela,passo.registro);
  deps.aplicarLocal?.(passo.tabela,passo.registro);
  if(!resultado.gravadoOnline)throw new Error('Criação pendente neste dispositivo. Sincronize e use Retomar criação; os mesmos IDs serão preservados.');
  passo.estado='CONFIRMADO';await deps.salvarCheckpoint(roteiro);
 }
 roteiro.estado='CONCLUIDO';await deps.salvarCheckpoint(roteiro);
}
