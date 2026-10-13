import { PRIMARY_KEYS } from '../services/recordIdentity';

/** Tabelas que exigem comparação de versão e escrita serializada no servidor. */
export const TABELAS_CRITICAS = new Set([
  'frequencias','encontros_turma','avaliacoes','avaliacoes_completas',
  'documentos','entregas','leituras_responsaveis',
]);

export type OperacaoCritica = 'INSERT' | 'UPDATE' | 'DELETE';
export interface EscritaCritica {
  tabela: string;
  tipo: OperacaoCritica;
  registro: Record<string, unknown>;
  esperado: Record<string, unknown> | null;
  operacaoId: string;
}
export class ConflitoDeVersao extends Error {
  readonly code = 'VERSION_CONFLICT';
  constructor(message = 'O registro foi alterado em outro dispositivo. Atualize e confira antes de reenviar.') {
    super(message);
    this.name = 'ConflitoDeVersao';
  }
}
export function valorComparavel(valor: unknown): string {
  if (valor == null) return '';
  if (typeof valor === 'boolean') return valor ? 'TRUE' : 'FALSE';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor).trim();
}

export function adaptarRegistroCritico(tabela: string, registro: Record<string, unknown>): Record<string, unknown> {
  const result={...registro};
  if(tabela==='frequencias' && result.status==='PRESENTE' && (result.atraso===true || result.status_original==='ATRASO'))result.status='ATRASO';
  if(tabela==='leituras_responsaveis'){
    result.leitura_agenda_id = result.leitura_agenda_id ?? result.leitura_id;
    if(Array.isArray(result.responsaveis_efetivos)) result.responsaveis_efetivos=JSON.stringify(result.responsaveis_efetivos);
  }
  if(tabela==='avaliacoes_completas' && result.notas_criterios!==undefined)
    result.notas_criterios_json=JSON.stringify(result.notas_criterios);
  if(tabela==='entregas'){
    result.tipo_entrega = result.tipo_entrega ?? result.tipo_documento;
    result.status = result.status ?? result.status_entrega;
    result.data_envio = result.data_envio ?? result.data_entrega;
  }
  return result;
}
export function idCritico(tabela:string, registro:Record<string,unknown>):string {
  if(tabela==='frequencias' && registro.matricula_id && registro.data_aula)
    return JSON.stringify([String(registro.matricula_id),String(registro.data_aula)]);
  const key=PRIMARY_KEYS[tabela];
  const value=key && (registro[key] ?? (tabela==='leituras_responsaveis' ? registro.leitura_id : undefined));
  if(!key || value==null || !String(value).trim()) throw new Error('Identificador do registro inválido');
  return String(value).trim();
}
export function compararVersaoDeCampos(
  tabela:string, registro:Record<string,unknown>, esperado:Record<string,unknown>|null,
  remoto:Record<string,unknown>|null, cabecalhos:string[],tipo:OperacaoCritica,
):string[]{
  if(tipo==='INSERT') return remoto ? ['registro já existe'] : [];
  if(!remoto) return ['registro não encontrado'];
  if(!esperado) return ['versão original indisponível'];
  const editado=adaptarRegistroCritico(tabela,registro);
  const base=adaptarRegistroCritico(tabela,esperado);
  const permitido=new Set(cabecalhos);
  const chaves=(tipo==='DELETE'?cabecalhos:Object.keys(editado)).filter(k=>permitido.has(k));
  const divergencias:string[]=[];
  for(const key of chaves){
    const original=valorComparavel(base[key]);
    const atual=valorComparavel(remoto[key]);
    if(original!==atual)divergencias.push(key);
  }
  return divergencias;
}
