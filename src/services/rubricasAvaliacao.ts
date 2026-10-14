/**
 * Rubricas versionadas, níveis de desempenho, descritores por tipo de estágio, rascunhos de avaliação
 * (individual e coletiva) e histórico. Domínio puro: não lê nem grava dados.
 *
 * Regras:
 *  - nível/ajuste produzem PRÉVIA; só viram nota oficial por confirmação explícita da professora;
 *  - versões são imutáveis: editar pesos cria nova versão; rascunhos guardam a versão e os pesos que usaram;
 *  - documento coletivo pode SUBSIDIAR avaliações individuais, nunca copia a mesma nota;
 *  - descritores por tipo de estágio são configuráveis; Consultoria Organizacional fica sem descritores clínicos.
 */
import { FATOR_NIVEL, formatarPontos, type NivelDesempenho, type Subcriterio } from './avaliacaoEngine';

export type TipoEstagio = 'CLINICA_ADULTO' | 'CLINICA_AMPLIADA' | 'CONSULTORIA_ORGANIZACIONAL' | 'OUTRO';
export type StatusRubrica = 'rascunho' | 'aprovada';
export type EscopoAvaliacao = 'INDIVIDUAL' | 'COLETIVA';

export const NIVEIS: NivelDesempenho[] = ['EXCELENTE', 'ADEQUADO', 'PARCIAL', 'INSUFICIENTE', 'NAO_ATENDIDO', 'NAO_AVALIADO'];
export const ROTULO_NIVEL: Record<NivelDesempenho, string> = {
  EXCELENTE: 'Excelente', ADEQUADO: 'Adequado', PARCIAL: 'Parcial',
  INSUFICIENTE: 'Insuficiente', NAO_ATENDIDO: 'Não atendido', NAO_AVALIADO: 'Não avaliado',
};
export const DESCRICAO_NIVEL: Record<NivelDesempenho, string> = {
  EXCELENTE: 'Atende plenamente, com consistência e autonomia (100% do peso).',
  ADEQUADO: 'Atende ao esperado, com pequenos ajustes necessários (75% do peso).',
  PARCIAL: 'Atende parcialmente, com lacunas relevantes (50% do peso).',
  INSUFICIENTE: 'Apresenta dificuldades importantes (25% do peso).',
  NAO_ATENDIDO: 'Há evidência suficiente de não cumprimento (0% do peso).',
  NAO_AVALIADO: 'Sem pontuação: ainda não há dados suficientes ou a avaliação não foi realizada.',
};

export interface DefinicaoSubcriterio {
  subcriterio_id: string;
  nome: string;
  peso: number;
  foco: string[];
  /** descritor específico por nível; ausente = a definir pela professora */
  descritores: Partial<Record<NivelDesempenho, string>>;
}

export interface RubricaVersao {
  rubrica_id: string;
  versao: number;
  criterio_id: string;
  turma_id: string;
  periodo_id: string;
  tipo_estagio: TipoEstagio;
  status: StatusRubrica;
  subcriterios: DefinicaoSubcriterio[];
  peso_total: number;
  origem: string;
  criado_em: string;
  criado_por: string;
  aprovado_em?: string;
  aprovado_por?: string;
  motivo_alteracao?: string;
}

export interface AjusteSelecao { nota: number; justificativa: string }
export interface SelecaoNivel {
  subcriterio_id: string;
  nivel: NivelDesempenho;
  ajuste?: AjusteSelecao | null;
  comentario?: string;
  origem: 'professora' | 'grupo' | 'monitora_sugestao';
}
export interface EventoHistorico {
  em: string; por: string; acao: 'NIVEL' | 'AJUSTE' | 'COMENTARIO' | 'ADOCAO_SUBSIDIO' | 'CONFIRMACAO' | 'CRIACAO';
  subcriterio_id?: string; antes?: string; depois?: string; motivo?: string;
}
export interface RascunhoAvaliacao {
  rascunho_id: string;
  matricula_id: string;
  grupo_id?: string;
  escopo: EscopoAvaliacao;
  criterio_id: string;
  rubrica_id: string;
  rubrica_versao: number;
  /** pesos da versão usada: uma nova versão da rubrica não altera este rascunho retroativamente */
  pesos: Record<string, number>;
  selecoes: SelecaoNivel[];
  status: 'RASCUNHO' | 'CONFIRMADA';
  historico: EventoHistorico[];
  atualizado_em: string;
}

// ---------------------------------------------------------------------------------------------
// Modelo de documentação (2,5 pontos). Pesos conforme definição da professora; editáveis e versionados.
// ---------------------------------------------------------------------------------------------

const TERMOS: Record<TipoEstagio, { dados: string; registros: string; extras: Record<string, string[]>; pendente?: boolean }> = {
  CLINICA_ADULTO: {
    dados: 'as informações do caso e do atendimento', registros: 'os registros de atendimento',
    extras: {
      'DOC-RACIOCINIO': ['Formulação e compreensão do caso', 'Evolução do raciocínio clínico'],
      'DOC-REGISTROS': ['Qualidade dos registros de atendimento'],
      'DOC-FUNDAMENTACAO': ['Fundamentação das intervenções', 'Articulação entre teoria e prática'],
      'DOC-ETICA': ['Adequação ética da documentação'],
    },
  },
  CLINICA_AMPLIADA: {
    dados: 'as demandas do contexto e as ações planejadas', registros: 'os registros produzidos pelo grupo',
    extras: {
      'DOC-RACIOCINIO': ['Compreensão das demandas do contexto', 'Planejamento das ações', 'Análise crítica da prática'],
      'DOC-REGISTROS': ['Qualidade dos registros produzidos em grupo'],
      'DOC-FUNDAMENTACAO': ['Fundamentação das intervenções', 'Avaliação das atividades desenvolvidas'],
    },
  },
  CONSULTORIA_ORGANIZACIONAL: {
    dados: 'as informações da demanda organizacional', registros: 'os registros da atividade', extras: {}, pendente: true,
  },
  OUTRO: { dados: 'as informações disponíveis', registros: 'os registros', extras: {} },
};

type Textos = Record<Exclude<NivelDesempenho, 'NAO_AVALIADO'>, string>;
function descritores(t: (typeof TERMOS)[TipoEstagio], id: string): Textos {
  const d = t.dados, r = t.registros;
  const mapa: Record<string, Textos> = {
    'DOC-RACIOCINIO': {
      EXCELENTE: `Analisa ${d} de forma integrada, identifica os aspectos relevantes, articula dados e hipóteses e justifica as decisões técnicas com coerência e autonomia.`,
      ADEQUADO: `Analisa ${d} e justifica as decisões com coerência; há pequenos ajustes na articulação entre dados e hipóteses.`,
      PARCIAL: `Analisa parte de ${d}; a articulação entre dados e hipóteses ou a justificativa das decisões apresenta lacunas relevantes.`,
      INSUFICIENTE: `Análise superficial de ${d}; hipóteses e decisões pouco justificadas ou com incoerências importantes.`,
      NAO_ATENDIDO: `Não há evidência de análise técnica de ${d} nos documentos avaliados.`,
    },
    'DOC-REGISTROS': {
      EXCELENTE: `${cap(r)} são completos, objetivos, precisos e coerentes com as atividades realizadas; o trabalho é plenamente compreensível a partir deles.`,
      ADEQUADO: `${cap(r)} são completos e objetivos; faltam pequenos detalhes de precisão ou relevância.`,
      PARCIAL: `${cap(r)} são parcialmente completos; há lacunas de informação ou trechos pouco objetivos que dificultam a compreensão do trabalho.`,
      INSUFICIENTE: `${cap(r)} são insuficientes: informações importantes ausentes, imprecisas ou pouco coerentes com as atividades.`,
      NAO_ATENDIDO: `Não há ${r} suficientes para compreender o trabalho realizado.`,
    },
    'DOC-FUNDAMENTACAO': {
      EXCELENTE: 'Articula teoria e prática, usa conceitos de modo adequado e fundamenta as intervenções em evidências científicas, justificando as escolhas profissionais com autonomia.',
      ADEQUADO: 'Articula teoria e prática e fundamenta as intervenções; há pequenos ajustes no uso de conceitos ou de evidências.',
      PARCIAL: 'A fundamentação é parcial: a articulação entre teoria e prática ou o uso de conceitos e evidências apresenta lacunas relevantes.',
      INSUFICIENTE: 'Fundamentação frágil: conceitos usados de forma inadequada ou intervenções pouco justificadas por evidências.',
      NAO_ATENDIDO: 'Não há fundamentação técnico-científica identificável nas escolhas registradas.',
    },
    'DOC-ETICA': {
      EXCELENTE: 'Protege as informações, respeita o sigilo, registra de forma adequada e reconhece os limites da atuação, cumprindo as normas profissionais e institucionais.',
      ADEQUADO: 'Cumpre as normas de sigilo e adequação dos registros; há pequenos ajustes pontuais.',
      PARCIAL: 'Há lacunas relevantes na proteção das informações, na adequação dos registros ou no reconhecimento dos limites da atuação.',
      INSUFICIENTE: 'Dificuldades importantes com sigilo, adequação dos registros ou normas profissionais; requer orientação.',
      NAO_ATENDIDO: 'Há evidência de descumprimento de normas éticas ou de sigilo (análise obrigatória da professora; sem desconto automático).',
    },
    'DOC-REGULARIDADE': {
      EXCELENTE: 'Mantém registros contínuos, cumpre as entregas, atualiza a documentação e responde às orientações recebidas de forma regular ao longo do semestre.',
      ADEQUADO: 'Mantém regularidade com poucas oscilações de continuidade ou de atualização.',
      PARCIAL: 'Regularidade parcial: lacunas na continuidade das entregas ou na resposta às orientações.',
      INSUFICIENTE: 'Registros descontínuos e entregas frequentemente pendentes; resposta limitada às orientações.',
      NAO_ATENDIDO: 'Não há evidência de continuidade nem de cumprimento das entregas no período.',
    },
    'DOC-ORGANIZACAO': {
      EXCELENTE: 'Documentos organizados, legíveis, com escrita clara, linguagem técnico-científica e estrutura adequada, de fácil compreensão.',
      ADEQUADO: 'Documentos organizados e claros; pequenos ajustes de estrutura, legibilidade ou linguagem.',
      PARCIAL: 'Organização ou clareza parcial: problemas de estrutura, legibilidade ou linguagem que atrapalham a leitura.',
      INSUFICIENTE: 'Organização e clareza insuficientes; a compreensão fica comprometida.',
      NAO_ATENDIDO: 'Documentos sem organização mínima ou ilegíveis para avaliação.',
    },
  };
  return mapa[id];
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const BASE: Array<{ id: string; nome: string; peso: number; foco: string[] }> = [
  { id: 'DOC-RACIOCINIO', nome: 'Raciocínio técnico e clínico', peso: 0.65, foco: ['Análise das informações disponíveis', 'Identificação dos aspectos relevantes', 'Articulação entre dados e hipóteses', 'Justificativa das decisões técnicas', 'Coerência do raciocínio profissional'] },
  { id: 'DOC-REGISTROS', nome: 'Qualidade e suficiência dos registros', peso: 0.5, foco: ['Completude', 'Objetividade', 'Relevância', 'Precisão', 'Coerência com as atividades realizadas', 'Informações suficientes para compreender o trabalho'] },
  { id: 'DOC-FUNDAMENTACAO', nome: 'Fundamentação técnico-científica', peso: 0.45, foco: ['Articulação entre teoria e prática', 'Uso adequado de conceitos', 'Fundamentação das intervenções', 'Coerência com evidências científicas', 'Capacidade de justificar escolhas profissionais'] },
  { id: 'DOC-ETICA', nome: 'Ética, sigilo e normas profissionais', peso: 0.4, foco: ['Proteção das informações', 'Respeito ao sigilo', 'Adequação dos registros', 'Limites da atuação profissional', 'Cumprimento de normas profissionais e institucionais'] },
  { id: 'DOC-REGULARIDADE', nome: 'Regularidade e cumprimento de prazos', peso: 0.3, foco: ['Continuidade dos registros', 'Cumprimento das entregas', 'Atualização da documentação', 'Resposta às orientações recebidas', 'Regularidade durante o semestre'] },
  { id: 'DOC-ORGANIZACAO', nome: 'Organização e clareza', peso: 0.2, foco: ['Organização dos documentos', 'Legibilidade', 'Clareza da escrita', 'Linguagem técnico-científica', 'Estrutura adequada', 'Facilidade de compreensão'] },
];

export const PESO_DOCUMENTACAO = 2.5;
const somar = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

/** Cria a versão 1 da rubrica de Documentação para um tipo de estágio. Consultoria: sem descritores clínicos. */
export function criarRubricaDocumentacao(p: {
  tipoEstagio: TipoEstagio; criterioId: string; turmaId: string; periodoId: string; criadoPor: string; agora: string;
}): RubricaVersao {
  const t = TERMOS[p.tipoEstagio];
  const subs: DefinicaoSubcriterio[] = BASE.map(b => ({
    subcriterio_id: b.id,
    nome: b.nome,
    peso: b.peso,
    foco: Array.from(new Set([...b.foco, ...(t.extras[b.id] ?? [])])),
    // Consultoria Organizacional: arquitetura pronta, descritores a definir (não aplicar descritores clínicos)
    descritores: t.pendente ? {} : { ...descritores(t, b.id) },
  }));
  return {
    rubrica_id: `RUB-${p.criterioId}-${p.periodoId}`,
    versao: 1,
    criterio_id: p.criterioId, turma_id: p.turmaId, periodo_id: p.periodoId,
    tipo_estagio: p.tipoEstagio,
    status: t.pendente ? 'rascunho' : 'aprovada',
    subcriterios: subs,
    peso_total: somar(subs.map(s => s.peso)),
    origem: 'modelo_documentacao_definido_pela_professora',
    criado_em: p.agora, criado_por: p.criadoPor,
    ...(t.pendente ? {} : { aprovado_em: p.agora, aprovado_por: 'professora (definição dos pesos na solicitação)' }),
  };
}

export interface ProblemaRubrica { codigo: string; mensagem: string }

/** Pesos devem fechar o valor do critério (ex.: 2,5) e os identificadores devem ser estáveis e únicos. */
export function validarRubrica(r: RubricaVersao, valorCriterio: number): ProblemaRubrica[] {
  const p: ProblemaRubrica[] = [];
  const ids = r.subcriterios.map(s => s.subcriterio_id);
  if (new Set(ids).size !== ids.length) p.push({ codigo: 'ID_DUPLICADO', mensagem: 'Identificadores de subcritério duplicados.' });
  if (r.subcriterios.some(s => !(s.peso >= 0) || !Number.isFinite(s.peso))) p.push({ codigo: 'PESO_INVALIDO', mensagem: 'Peso inválido.' });
  if (Math.abs(somar(r.subcriterios.map(s => s.peso)) - valorCriterio) > 1e-9) p.push({ codigo: 'SOMA_PESOS', mensagem: `A soma dos pesos deve ser ${formatarPontos(valorCriterio)}.` });
  return p;
}

/** Edita pesos/descritores criando NOVA versão (a anterior permanece imutável). */
export function novaVersaoRubrica(anterior: RubricaVersao, alteracoes: {
  subcriterios: DefinicaoSubcriterio[]; criadoPor: string; agora: string; motivo: string; valorCriterio: number;
}): RubricaVersao {
  if (!alteracoes.motivo.trim()) throw new Error('Informe o motivo da alteração da rubrica.');
  const proxima: RubricaVersao = {
    ...anterior,
    versao: anterior.versao + 1,
    status: 'rascunho',
    subcriterios: alteracoes.subcriterios.map(s => ({ ...s, foco: [...s.foco], descritores: { ...s.descritores } })),
    peso_total: somar(alteracoes.subcriterios.map(s => s.peso)),
    criado_em: alteracoes.agora, criado_por: alteracoes.criadoPor,
    aprovado_em: undefined, aprovado_por: undefined, motivo_alteracao: alteracoes.motivo,
  };
  const problemas = validarRubrica(proxima, alteracoes.valorCriterio);
  if (problemas.length) throw new Error(problemas.map(p => p.mensagem).join(' '));
  return proxima;
}

export function aprovarRubrica(r: RubricaVersao, por: string, agora: string): RubricaVersao {
  return { ...r, status: 'aprovada', aprovado_em: agora, aprovado_por: por };
}

// ---------------------------------------------------------------------------------------------
// Rascunhos de avaliação (individual/coletiva) e histórico
// ---------------------------------------------------------------------------------------------

export function novoRascunho(p: {
  rascunhoId: string; matriculaId: string; grupoId?: string; escopo: EscopoAvaliacao; rubrica: RubricaVersao; agora: string; por: string;
}): RascunhoAvaliacao {
  return {
    rascunho_id: p.rascunhoId, matricula_id: p.matriculaId, grupo_id: p.grupoId, escopo: p.escopo,
    criterio_id: p.rubrica.criterio_id, rubrica_id: p.rubrica.rubrica_id, rubrica_versao: p.rubrica.versao,
    pesos: Object.fromEntries(p.rubrica.subcriterios.map(s => [s.subcriterio_id, s.peso])),
    selecoes: [], status: 'RASCUNHO', atualizado_em: p.agora,
    historico: [{ em: p.agora, por: p.por, acao: 'CRIACAO', depois: `rubrica v${p.rubrica.versao}` }],
  };
}

function bloquearSeConfirmada(r: RascunhoAvaliacao) {
  if (r.status === 'CONFIRMADA') throw new Error('Avaliação confirmada: crie uma nova revisão para alterar.');
}
function selecaoDe(r: RascunhoAvaliacao, id: string) { return r.selecoes.find(s => s.subcriterio_id === id); }
function trocar(r: RascunhoAvaliacao, nova: SelecaoNivel): SelecaoNivel[] {
  return [...r.selecoes.filter(s => s.subcriterio_id !== nova.subcriterio_id), nova];
}

export function selecionarNivel(r: RascunhoAvaliacao, subcriterioId: string, nivel: NivelDesempenho, por: string, agora: string): RascunhoAvaliacao {
  bloquearSeConfirmada(r);
  if (!(subcriterioId in r.pesos)) throw new Error('Subcritério não pertence à versão da rubrica deste rascunho.');
  if (!NIVEIS.includes(nivel)) throw new Error('Nível inválido.');
  const ant = selecaoDe(r, subcriterioId);
  return {
    ...r, atualizado_em: agora,
    selecoes: trocar(r, { subcriterio_id: subcriterioId, nivel, ajuste: ant?.ajuste ?? null, comentario: ant?.comentario, origem: 'professora' }),
    historico: [...r.historico, { em: agora, por, acao: 'NIVEL', subcriterio_id: subcriterioId, antes: ant?.nivel, depois: nivel }],
  };
}

/** Ajuste manual da pontuação do subcritério: exige justificativa e fica no histórico. */
export function ajustarPontuacao(r: RascunhoAvaliacao, subcriterioId: string, nota: number, justificativa: string, por: string, agora: string): RascunhoAvaliacao {
  bloquearSeConfirmada(r);
  const peso = r.pesos[subcriterioId];
  if (peso === undefined) throw new Error('Subcritério não pertence à versão da rubrica deste rascunho.');
  if (!justificativa.trim()) throw new Error('Informe a justificativa do ajuste.');
  if (!Number.isFinite(nota) || nota < 0 || nota > peso + 1e-9) throw new Error(`O ajuste deve ficar entre 0 e ${formatarPontos(peso)}.`);
  const ant = selecaoDe(r, subcriterioId);
  return {
    ...r, atualizado_em: agora,
    selecoes: trocar(r, { subcriterio_id: subcriterioId, nivel: ant?.nivel ?? 'NAO_AVALIADO', ajuste: { nota, justificativa }, comentario: ant?.comentario, origem: 'professora' }),
    historico: [...r.historico, { em: agora, por, acao: 'AJUSTE', subcriterio_id: subcriterioId, antes: ant?.ajuste ? String(ant.ajuste.nota) : undefined, depois: String(nota), motivo: justificativa }],
  };
}

export function comentarSubcriterio(r: RascunhoAvaliacao, subcriterioId: string, comentario: string, por: string, agora: string): RascunhoAvaliacao {
  bloquearSeConfirmada(r);
  const ant = selecaoDe(r, subcriterioId);
  return {
    ...r, atualizado_em: agora,
    selecoes: trocar(r, { subcriterio_id: subcriterioId, nivel: ant?.nivel ?? 'NAO_AVALIADO', ajuste: ant?.ajuste ?? null, comentario, origem: ant?.origem ?? 'professora' }),
    historico: [...r.historico, { em: agora, por, acao: 'COMENTARIO', subcriterio_id: subcriterioId }],
  };
}

/** Subcritérios da engine a partir do rascunho (pesos do snapshot da versão usada). */
export function subcriteriosParaEngine(rubrica: RubricaVersao, r: RascunhoAvaliacao): Subcriterio[] {
  return rubrica.subcriterios.map(def => {
    const sel = selecaoDe(r, def.subcriterio_id);
    return {
      id: def.subcriterio_id, criterioId: rubrica.criterio_id, nome: def.nome, maxPontos: r.pesos[def.subcriterio_id] ?? def.peso,
      nivel: sel?.nivel ?? 'NAO_AVALIADO', ajuste: sel?.ajuste ?? null, observacoes: sel?.comentario,
      descritores: Object.entries(def.descritores).map(([nivel, texto]) => ({ nivel, texto })),
    } as Subcriterio;
  });
}

/** Descritor do nível escolhido (para mostrar na tela e citar na devolutiva). */
export function descritorDoNivel(rubrica: RubricaVersao, subcriterioId: string, nivel: NivelDesempenho): string {
  const def = rubrica.subcriterios.find(s => s.subcriterio_id === subcriterioId);
  const texto = def?.descritores[nivel];
  return texto ?? (nivel === 'NAO_AVALIADO' ? DESCRICAO_NIVEL.NAO_AVALIADO : 'Descritor a definir pela professora para este tipo de estágio.');
}

export function pontuacaoSugerida(rubrica: RubricaVersao, r: RascunhoAvaliacao): { total: number | null; parcial: number | null; avaliados: number; total_subcriterios: number } {
  let soma = 0, avaliados = 0;
  for (const def of rubrica.subcriterios) {
    const sel = selecaoDe(r, def.subcriterio_id);
    const peso = r.pesos[def.subcriterio_id] ?? def.peso;
    if (sel?.ajuste && sel.ajuste.justificativa.trim()) { soma += sel.ajuste.nota; avaliados++; continue; }
    if (!sel || sel.nivel === 'NAO_AVALIADO') continue;
    soma += peso * (FATOR_NIVEL[sel.nivel] ?? 0); avaliados++;
  }
  const n = rubrica.subcriterios.length;
  return { total: avaliados === n ? soma : null, parcial: avaliados > 0 ? soma : null, avaliados, total_subcriterios: n };
}

/**
 * Monta a confirmação: mostra o que seria gravado e a diferença para a nota oficial atual.
 * NÃO grava nada; a gravação é um passo explícito da professora usando as regras de persistência existentes.
 */
export function prepararConfirmacao(rubrica: RubricaVersao, r: RascunhoAvaliacao, oficialAtual: number | null): {
  podeConfirmar: boolean; motivoBloqueio?: string; notaProposta: number | null; oficialAtual: number | null; diferenca: number | null; substituiOficial: boolean;
} {
  const ps = pontuacaoSugerida(rubrica, r);
  if (rubrica.status !== 'aprovada') return { podeConfirmar: false, motivoBloqueio: 'A versão da rubrica ainda não foi aprovada.', notaProposta: ps.total, oficialAtual, diferenca: null, substituiOficial: false };
  if (ps.total === null) return { podeConfirmar: false, motivoBloqueio: `Faltam ${ps.total_subcriterios - ps.avaliados} subcritério(s) a avaliar.`, notaProposta: null, oficialAtual, diferenca: null, substituiOficial: false };
  return {
    podeConfirmar: true, notaProposta: ps.total, oficialAtual,
    diferenca: oficialAtual === null ? null : ps.total - oficialAtual,
    substituiOficial: oficialAtual !== null && Math.abs(ps.total - oficialAtual) > 0.005,
  };
}

export function marcarConfirmada(r: RascunhoAvaliacao, por: string, agora: string): RascunhoAvaliacao {
  bloquearSeConfirmada(r);
  return { ...r, status: 'CONFIRMADA', atualizado_em: agora, historico: [...r.historico, { em: agora, por, acao: 'CONFIRMACAO' }] };
}

// ---------------------------------------------------------------------------------------------
// Documentação coletiva: subsidia avaliações individuais sem copiar a mesma nota
// ---------------------------------------------------------------------------------------------

/** Níveis do rascunho coletivo oferecidos como SUGESTÃO para um integrante. Nada é aplicado. */
export function subsidioDoGrupo(grupo: RascunhoAvaliacao, matriculaId: string, integrantes: string[]): SelecaoNivel[] {
  if (grupo.escopo !== 'COLETIVA') throw new Error('O rascunho de origem não é coletivo.');
  if (!integrantes.includes(matriculaId)) return [];
  return grupo.selecoes.map(s => ({ ...s, ajuste: null, origem: 'grupo' as const }));
}

/** Adoção explícita, subcritério a subcritério, pela professora. O individual continua independente. */
export function adotarSubsidio(individual: RascunhoAvaliacao, sugestao: SelecaoNivel, por: string, agora: string): RascunhoAvaliacao {
  bloquearSeConfirmada(individual);
  if (individual.escopo !== 'INDIVIDUAL') throw new Error('Só avaliações individuais adotam subsídio do grupo.');
  if (!(sugestao.subcriterio_id in individual.pesos)) throw new Error('Subcritério não pertence a este rascunho.');
  return {
    ...individual, atualizado_em: agora,
    selecoes: trocar(individual, { ...sugestao, ajuste: null, origem: 'grupo' }),
    historico: [...individual.historico, { em: agora, por, acao: 'ADOCAO_SUBSIDIO', subcriterio_id: sugestao.subcriterio_id, depois: sugestao.nivel }],
  };
}

/** Sugestão (não aplicada) de tipo de estágio pelo nome. Nunca definida automaticamente. */
export function sugerirTipoEstagio(nomeTurmaOuDisciplina: string): TipoEstagio | null {
  const t = nomeTurmaOuDisciplina.toLowerCase();
  if (t.includes('ampliada')) return 'CLINICA_AMPLIADA';
  if (t.includes('adulto')) return 'CLINICA_ADULTO';
  if (t.includes('organiza') || t.includes('consultoria')) return 'CONSULTORIA_ORGANIZACIONAL';
  return null;
}

/** Classificação inicial SUGERIDA para os critérios gerais (D3); a configuração por turma é quem decide. */
export const CLASSIFICACAO_SUGERIDA: Array<{ padrao: RegExp; tipo: 'proportional' | 'rubric' | 'continuous' | 'hybrid'; observacao: string }> = [
  { padrao: /prova/i, tipo: 'proportional', observacao: 'nota bruta ÷ 10 × valor' },
  { padrao: /introdu|relat[oó]rio/i, tipo: 'rubric', observacao: 'rubrica ou lançamento manual' },
  { padrao: /document/i, tipo: 'hybrid', observacao: 'rubrica de documentação + ajuste justificado' },
  { padrao: /semin[aá]rio|atividade/i, tipo: 'rubric', observacao: 'rubrica ou lançamento manual' },
  { padrao: /particip/i, tipo: 'continuous', observacao: 'qualitativa; sem pesos internos oficiais' },
  { padrao: /desempenho/i, tipo: 'hybrid', observacao: 'qualitativa; sem pesos internos oficiais' },
  { padrao: /assiduidade|pontualidade/i, tipo: 'hybrid', observacao: 'frequência e pontualidade; regra de faltas pendente (D2)' },
];
export function sugerirClassificacao(nomeCriterio: string): (typeof CLASSIFICACAO_SUGERIDA)[number] | null {
  return CLASSIFICACAO_SUGERIDA.find(c => c.padrao.test(nomeCriterio)) ?? null;
}
/** Prefere o código estável da planilha (codigo_criterio); os nomes variam entre turmas. Continua sendo só sugestão. */
export function sugerirClassificacaoCriterio(c: { codigo_criterio?: unknown; nome?: unknown }) {
  const codigo = String(c.codigo_criterio ?? '').replaceAll('_', ' ');
  return (codigo && sugerirClassificacao(codigo)) || sugerirClassificacao(String(c.nome ?? ''));
}
