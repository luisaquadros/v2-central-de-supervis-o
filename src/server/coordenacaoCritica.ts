import { PRIMARY_KEYS } from '../services/recordIdentity';

/** Tabelas que exigem comparação de versão e escrita serializada no servidor. */
export const TABELAS_CRITICAS = new Set([
  'frequencias','encontros_turma','avaliacoes','avaliacoes_completas',
  'documentos','entregas','leituras_responsaveis',
  // E1: registros de acompanhamento editáveis de dois aparelhos; antes iam direto, sem comparação de versão.
  'ocorrencias','orientacoes','feedback_alunos','feedbacks','pontos_acompanhamento',
  'registros_supervisao','preparacoes_aula',
  // Cadastro: migrado uma tabela por vez (cada linha abaixo é um passo reversível, ver docs/DOCUMENTO_MESTRE.md)
  'alunos','matriculas','turmas','horarios_turma',
  'periodos',
  'disciplinas',
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
/**
 * Datas chegam da planilha como DD/MM/AAAA, número de série ou ISO, e o aplicativo guarda ISO.
 * Na comparação de versão as duas pontas são levadas ao mesmo formato, para que a diferença de
 * formato não vire "conflito" falso. Só a comparação é afetada; o valor gravado não muda.
 */
function dataCanonica(texto: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{5}$/.test(texto)) return new Date(Date.UTC(1899, 11, 30) + Number(texto) * 86400000).toISOString().slice(0, 10);
  return texto;
}
export function valorComparavel(valor: unknown): string {
  if (valor == null) return '';
  if (typeof valor === 'boolean') return valor ? 'TRUE' : 'FALSE';
  if (typeof valor === 'object') return JSON.stringify(valor);
  const t = String(valor).trim();
  if (/^(true|false)$/i.test(t)) return t.toUpperCase();
  return dataCanonica(t);
}
const DIAS: Record<string, string> = { DOMINGO: '0', SEGUNDA: '1', TERCA: '2', 'TERÇA': '2', QUARTA: '3', QUINTA: '4', SEXTA: '5', SABADO: '6', 'SÁBADO': '6' };
/** Comparação por campo: o app guarda o dia da semana como número (0–6) e a planilha pode ter o nome do dia. */
export function valorComparavelCampo(tabela: string, campo: string, valor: unknown): string {
  const v = valorComparavel(valor);
  if (tabela === 'horarios_turma' && campo === 'dia_semana') return DIAS[v.toUpperCase()] ?? v;
  return v;
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
  if(tabela==='grupo_integrantes')result.grupo_integrante_id = result.grupo_integrante_id ?? result.integrante_id;
  if(tabela==='registros_supervisao'){
    result.data = result.data ?? result.data_hora;
    result.descricao = result.descricao ?? result.texto;
  }
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
  const value=key && (registro[key] ?? (tabela==='leituras_responsaveis' ? registro.leitura_id : tabela==='grupo_integrantes' ? registro.integrante_id : undefined));
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
    const original=valorComparavelCampo(tabela,key,base[key]);
    const atual=valorComparavelCampo(tabela,key,remoto[key]);
    if(original!==atual)divergencias.push(key);
  }
  return divergencias;
}

/** Colunas de texto livre: o log registra que mudaram, nunca o conteúdo (pode haver narrativa identificável). */
const CAMPO_TEXTO_LIVRE=/(observa|justific|descri|texto|narrativ|relato|comentari|conteudo|resumo|mensagem|duvida|limita|prioridade|proximo_passo|anotac|nota_texto|feedback|devolutiva|pauta|diario)/i;
const LIMITE_VALOR_LOG=80;
const CAMPOS_TECNICOS=new Set(['atualizado_em','criado_em','sincronizado_em']);

export interface AlteracaoParaLog {
  registro_id:string;
  campos:string[];
  antes:Record<string,string>;
  depois:Record<string,string>;
}
const valorSeguro=(campo:string,valor:unknown)=>CAMPO_TEXTO_LIVRE.test(campo)?'(texto)':valorComparavel(valor).slice(0,LIMITE_VALOR_LOG);

/**
 * Resumo auditável da operação: campos realmente alterados, com antes/depois só de valores curtos
 * e não textuais. Função pura, compartilhada pelo Worker e pelos testes.
 */
export function resumirAlteracaoParaLog(
  tabela:string, tipo:OperacaoCritica, registro:Record<string,unknown>,
  remotoAntes:Record<string,unknown>|null, cabecalhos:string[],
):AlteracaoParaLog{
  const novo=adaptarRegistroCritico(tabela,registro);
  const permitido=new Set(cabecalhos);
  const candidatos=(tipo==='DELETE'?cabecalhos:Object.keys(novo)).filter(k=>permitido.has(k)&&!CAMPOS_TECNICOS.has(k));
  const campos:string[]=[],antes:Record<string,string>={},depois:Record<string,string>={};
  for(const k of candidatos){
    const a=remotoAntes?valorComparavel(remotoAntes[k]):'';
    const d=tipo==='DELETE'?'':valorComparavel(novo[k]);
    if(tipo==='UPDATE'&&a===d)continue;
    if(tipo!=='INSERT'&&a!=='')antes[k]=valorSeguro(k,remotoAntes?.[k]);
    if(tipo!=='DELETE'&&d!=='')depois[k]=valorSeguro(k,novo[k]);
    campos.push(k);
  }
  return {registro_id:idCritico(tabela,registro),campos,antes,depois};
}
export const COLUNAS_LOG_ALTERACOES=[
  'log_id','ocorrido_em','usuario_verificado','tabela','registro_id','acao','campos','antes','depois','origem',
] as const;
export function linhaDeLog(
  operacaoId:string,agora:string,usuario:string,tabela:string,tipo:OperacaoCritica,a:AlteracaoParaLog,
):string[]{
  return [operacaoId,agora,usuario.slice(0,120),tabela,a.registro_id,tipo,a.campos.join(', '),
    JSON.stringify(a.antes),JSON.stringify(a.depois),'CENTRAL_WORKER'];
}
