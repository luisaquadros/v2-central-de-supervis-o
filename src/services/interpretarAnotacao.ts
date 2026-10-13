/**
 * Interpretação de anotações rápidas (regras simples, sem IA e sem envio de dados para fora).
 * Ex.: "Ana mandou atestado da falta de ontem" → justificativa de falta, Ana, data de ontem.
 * Sempre é uma SUGESTÃO: a professora confirma antes de registrar.
 */
import type { Aluno, Matricula } from '../types';
import { textoComparavel } from './normalizacaoPlanilha';
import { getHojeDataIso, somarDias, dataLocal } from './supervisaoOperacionalService';

export type TipoAnotacao = 'JUSTIFICATIVA' | 'FALTA' | 'ATRASO' | 'CELULAR' | 'DOCUMENTO' | 'ORIENTACAO' | 'LEMBRETE';

export const ROTULO_TIPO_ANOTACAO: Record<TipoAnotacao, string> = {
  JUSTIFICATIVA: 'Justificativa de falta',
  FALTA: 'Falta',
  ATRASO: 'Atraso',
  CELULAR: 'Uso de celular',
  DOCUMENTO: 'Documento entregue',
  ORIENTACAO: 'Orientação',
  LEMBRETE: 'Lembrete',
};

export interface Interpretacao {
  tipo: TipoAnotacao;
  matriculaId?: string;
  candidatos: { matriculaId: string; nome: string }[];
  data: string;
  /** A anotação fala de algo futuro ("vai faltar amanhã"). */
  futuro: boolean;
  tipoDocumento?: string;
}

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

export function extrairData(texto: string, hoje: string = getHojeDataIso()): { data: string; futuro: boolean } {
  const t = textoComparavel(texto);
  const futuro = /\b(amanha|vai|vai faltar|nao vira|nao vai|proxima)\b/.test(t);
  if (/\banteontem\b/.test(t)) return { data: somarDias(hoje, -2), futuro: false };
  if (/\bontem\b/.test(t)) return { data: somarDias(hoje, -1), futuro: false };
  if (/\bamanha\b/.test(t)) return { data: somarDias(hoje, 1), futuro: true };
  const dm = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(t);
  if (dm) {
    const ano = dm[3] ? (dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : hoje.slice(0, 4);
    return { data: `${ano}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`, futuro };
  }
  const idx = DIAS.findIndex(d => new RegExp(`\\b${d}`).test(t));
  if (idx >= 0) {
    const hojeDia = dataLocal(hoje).getDay();
    let diff = futuro ? (idx - hojeDia + 7) % 7 : -((hojeDia - idx + 7) % 7);
    if (diff === 0 && !/\bhoje\b/.test(t)) diff = futuro ? 7 : -7;
    return { data: somarDias(hoje, diff), futuro };
  }
  return { data: hoje, futuro };
}

export function interpretarAnotacao(
  texto: string,
  estudantes: { matricula: Matricula; aluno: Aluno }[],
  hoje: string = getHojeDataIso()
): Interpretacao {
  const t = textoComparavel(texto);
  const { data, futuro } = extrairData(texto, hoje);

  // Estudante: nome completo > nome + sobrenome > primeiro nome (se único).
  const palavras = new Set(t.split(/[^a-z0-9]+/).filter(Boolean));
  const pontuados = estudantes.map(e => {
    const partes = textoComparavel(e.aluno.nome).split(' ').filter(p => p.length > 2);
    const acertos = partes.filter(p => palavras.has(p)).length;
    const completo = t.includes(textoComparavel(e.aluno.nome)) ? 10 : 0;
    const primeiro = partes[0] && palavras.has(partes[0]) ? 1 : 0;
    return { e, pontos: completo + acertos + primeiro };
  }).filter(x => x.pontos >= 2).sort((a, b) => b.pontos - a.pontos);
  const melhor = pontuados[0];
  const empate = pontuados.filter(p => p.pontos === melhor?.pontos);
  const candidatos = pontuados.slice(0, 5).map(p => ({ matriculaId: p.e.matricula.matricula_id, nome: p.e.aluno.nome }));

  let tipo: TipoAnotacao = 'LEMBRETE';
  let tipoDocumento: string | undefined;
  if (/atestad|justific|declarac|medic|doente|internad|luto|consulta/.test(t)) tipo = 'JUSTIFICATIVA';
  else if (/\b(faltou|falta|faltar|ausente|nao vira|nao vai vir|nao veio)\b/.test(t)) tipo = 'FALTA';
  else if (/atras|chegou tarde|chegou depois/.test(t)) tipo = 'ATRASO';
  else if (/celular|telefone em aula|whatsapp em aula/.test(t)) tipo = 'CELULAR';
  else if (/(entregou|enviou|mandou).*(termo|tcle|manual|documento|ficha|contrato)|(termo|tcle|manual).*(entregue|enviado|assinado)/.test(t)) {
    tipo = 'DOCUMENTO';
    tipoDocumento = /manual/.test(t) ? 'MANUAL_ESTAGIO' : /termo|contrato/.test(t) ? 'TERMO_COMPROMISSO' : /tcle/.test(t) ? 'TCLE' : 'DOCUMENTACAO_EXTERNA';
  } else if (/orient|retomar|caso|manejo|sigilo|supervis|paciente/.test(t)) tipo = 'ORIENTACAO';

  return {
    tipo,
    matriculaId: melhor && empate.length === 1 ? melhor.e.matricula.matricula_id : undefined,
    candidatos,
    data,
    futuro,
    tipoDocumento,
  };
}
