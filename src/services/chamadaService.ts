/**
 * Encerramento da chamada por exceção (decisão D1).
 * Enquanto a chamada está aberta, quem não foi marcado está NÃO REGISTRADO: não é presente nem ausente.
 * Só ao ENCERRAR, com prévia e confirmação explícita, os não marcados passam a ser gravados como presentes.
 * O mapeamento de falta/justificativa é o já existente (não define regra de faltas: ver D2).
 */
import type { Frequencia } from '../types';
import { geraRegistroAutomatico } from './condicoesMatricula';

export interface ItemChamada { matricula: { matricula_id: string; papel_na_turma?: unknown }; aluno: { nome: string } }
export interface ExcecaoChamada { faltou: boolean; atraso: boolean; celular: boolean; justificativa?: string; observacao?: string }
export interface RegistroChamada { matriculaId: string; status: Frequencia['status']; justificativa?: string; atraso?: boolean; celular?: boolean; observacao?: string }

export interface PreviaChamada {
  /** Serão gravados como PRESENTE (inclui os que chegaram atrasados). */
  presentes: ItemChamada[];
  /** Subconjunto de `presentes` com atraso marcado. */
  atrasos: ItemChamada[];
  faltas: { item: ItemChamada; status: Frequencia['status'] }[];
  /** Horário alternativo sem marcação: nada será gravado. */
  semRegistro: ItemChamada[];
  registros: RegistroChamada[];
}

const marcada = (e?: ExcecaoChamada) => !!e && (e.faltou || e.atraso || e.celular || !!e.justificativa || !!e.observacao);

/** Quem ainda está NÃO REGISTRADO com a chamada aberta (sem marcação alguma). */
export const naoRegistrados = (lista: ItemChamada[], excecoes: Record<string, ExcecaoChamada | undefined>) =>
  lista.filter(i => !marcada(excecoes[i.matricula.matricula_id]));

export function prepararEncerramentoChamada(lista: ItemChamada[], excecoes: Record<string, ExcecaoChamada | undefined>): PreviaChamada {
  const previa: PreviaChamada = { presentes: [], atrasos: [], faltas: [], semRegistro: [], registros: [] };
  for (const item of lista) {
    const id = item.matricula.matricula_id, exc = excecoes[id];
    if (!geraRegistroAutomatico(item.matricula, marcada(exc))) { previa.semRegistro.push(item); continue; }
    const status: Frequencia['status'] = exc?.faltou ? (exc.justificativa ? 'JUSTIFICATIVA_PENDENTE' : 'FALTA_SEM_JUSTIFICATIVA') : 'PRESENTE';
    previa.registros.push({ matriculaId: id, status, justificativa: exc?.justificativa, atraso: exc?.atraso, celular: exc?.celular, observacao: exc?.observacao });
    if (status === 'PRESENTE') { previa.presentes.push(item); if (exc?.atraso) previa.atrasos.push(item); }
    else previa.faltas.push({ item, status });
  }
  return previa;
}

/** Segurança da retroatividade: nenhuma presença coletiva sem confirmação individual. */
export function naoConfirmadosRetrospectivos(lista:ItemChamada[], confirmados:Record<string,boolean>, retrospectivo:boolean):ItemChamada[] {
  if(!retrospectivo) return [];
  return lista.filter(i=>geraRegistroAutomatico(i.matricula,false) && !confirmados[i.matricula.matricula_id]);
}
