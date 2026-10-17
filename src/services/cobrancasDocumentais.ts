import type { Configuracao } from '../types';

/** Histórico administrativo, independente do status acadêmico da entrega. */
export type SituacaoCobranca = 'CONTATO_ENVIADO' | 'AGUARDANDO_RETORNO' | 'RESPONDEU_PENDENTE' | 'RECEBIDO_A_CONFERIR' | 'ENCERRADA';
export type CanalCobranca = 'EMAIL' | 'WHATSAPP' | 'PRESENCIAL' | 'OUTRO';
export interface EventoCobranca {
  id: string;
  registrado_em: string; // quando a professora registrou no sistema
  data_contato: string; // data informada do contato; vazio = data desconhecida
  canal: CanalCobranca;
  situacao: SituacaoCobranca;
  nota: string;
}
export interface ControleCobranca { versao: 1; eventos: EventoCobranca[]; }
export const PREFIXO_COBRANCA = 'CONTATO_DOCUMENTO:';

export const chaveCobranca = (matriculaId: string, tipo: string) =>
  PREFIXO_COBRANCA + matriculaId.trim() + ':' + tipo.trim().toUpperCase().replace(/\s+/g, '_');

export function lerCobranca(configuracoes: Configuracao[], periodoId: string, matriculaId: string, tipo: string): ControleCobranca {
  const chave = chaveCobranca(matriculaId, tipo);
  const c = configuracoes.find(x => x.chave === chave && x.periodo_id === periodoId);
  if (!c) return { versao: 1, eventos: [] };
  try {
    const v = JSON.parse(c.valor);
    if (v?.versao !== 1 || !Array.isArray(v.eventos)) return {versao: 1, eventos: []};
    const eventos = v.eventos.filter((e: any) => typeof e.id === 'string' && typeof e.registrado_em === 'string'
      && ['CONTATO_ENVIADO','AGUARDANDO_RETORNO','RESPONDEU_PENDENTE','RECEBIDO_A_CONFERIR','ENCERRADA'].includes(e.situacao)
    ).map((e: EventoCobranca) => ({...e, nota: String(e.nota || '').slice(0,250)}));
    return {versao:1, eventos};
  } catch { return {versao:1, eventos:[]}; }
}
export function novoEventoCobranca(dados: Omit<EventoCobranca, 'id'|'registrado_em'>,
  id: string, agora: string): EventoCobranca {
  if (dados.data_contato && !/^\d{4}-\d{2}-\d{2}$/.test(dados.data_contato)) throw new Error('Data inválida.');
  if (!['EMAIL','WHATSAPP','PRESENCIAL','OUTRO'].includes(dados.canal)) throw new Error('Canal inválido.');
  if (!['CONTATO_ENVIADO','AGUARDANDO_RETORNO','RESPONDEU_PENDENTE','RECEBIDO_A_CONFERIR','ENCERRADA'].includes(dados.situacao)) throw new Error('Situação inválida.');
  return { ...dados, nota: dados.nota.slice(0,250), id, registrado_em: agora };
}
export function ultimaCobranca(eventos: EventoCobranca[]): EventoCobranca | undefined {
  return [...eventos].sort((a,b)=>b.registrado_em.localeCompare(a.registrado_em))[0];
}
export function eventosCobrancaNoPeriodo(configuracoes: Configuracao[], periodoId: string) {
  return configuracoes.filter(c => c.periodo_id === periodoId && c.chave.startsWith(PREFIXO_COBRANCA));
}
