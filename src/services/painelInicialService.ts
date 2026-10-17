import type { ItemPendenciaOperacional } from '../types';
import type { ResultadoProximaSupervisao } from './supervisaoOperacionalService';

/** Limite aplicado na fonte do painel, antes da renderização; o calendário mantém a agenda completa. */
export function selecionarTresProximasAulas(agenda: ResultadoProximaSupervisao[]): ResultadoProximaSupervisao[] {
  return [...agenda].sort((a,b) => a.dataProxima.localeCompare(b.dataProxima) ||
    a.horaInicio.localeCompare(b.horaInicio) ||
    a.turma.nome.localeCompare(b.turma.nome, 'pt-BR')).slice(0,3);
}
const TEMAS: Record<string, string> = {
  CHAMADA: 'Chamadas para regularizar',
  DOCUMENTO: 'Documentação a acompanhar',
  RSS_ATRASADO: 'RSS recente em atraso',
  ORIENTACAO: 'Orientações em aberto',
  JUSTIFICATIVA: 'Justificativas para conferir',
  FALTA_INJUSTIFICADA: 'Frequências a verificar',
  PRAZO: 'Prazos vencidos',
  ESTUDO_DIRIGIDO: 'Leituras dirigidas',
  REGISTRO_SEMANAL: 'Registros semanais',
};
const PRIORIDADES=['CHAMADA','DOCUMENTO','RSS_ATRASADO','JUSTIFICATIVA','FALTA_INJUSTIFICADA','ORIENTACAO','PRAZO','ESTUDO_DIRIGIDO','REGISTRO_SEMANAL'];
export interface ResumoTemaPendencia { chave:string;titulo:string;descricao:string;quantidade:number; }

/** Mostra volumes por assunto e número de turmas, sem expor texto clínico do estudante na home. */
export function resumirPendenciasPorTema(pendencias: ItemPendenciaOperacional[]): ResumoTemaPendencia[] {
  const porTipo=new Map<string,{qtd:number;turmas:Set<string>}>();
  for(const p of pendencias) {
    const g=porTipo.get(p.tipo)||{qtd:0,turmas:new Set<string>()};
    g.qtd++;
    if(p.turma_id)g.turmas.add(p.turma_id);
    porTipo.set(p.tipo,g);
  }
  return [...porTipo].map(([tipo,grupo])=>({
    chave:tipo,
    titulo:TEMAS[tipo]||tipo.replaceAll('_',' '),
    quantidade:grupo.qtd,
    descricao:grupo.turmas.size ? String(grupo.turmas.size)+' turma(s) envolvida(s)' : 'Pendências do semestre',
  })).sort((a,b)=>{
    const rank=(key:string)=>{const index=PRIORIDADES.indexOf(key);return index<0?PRIORIDADES.length:index;};
    return rank(a.chave)-rank(b.chave)||b.quantidade-a.quantidade;
  });
}
