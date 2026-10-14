import type {RubricaVersao} from './rubricasAvaliacao';
import {linhaParaConfig,linhaParaRubrica,configParaLinha,rubricaParaLinha} from './estruturaAvaliacao';
import type {ConfigAvaliacao} from './estruturaAvaliacao';
import type { Periodo, Turma, CriterioAvaliacao, HorarioTurma } from "../types";

export function validarNovoPeriodo(
  nome: string,
  inicio: string,
  fim: string,
  periodos: Periodo[],
  inicioAulas?: string,
) {
  const data = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (!nome.trim() || nome.trim().length > 80)
    throw new Error("Informe uma identificação para o semestre.");
  if (
    periodos.some(
      (p) =>
        p.nome.trim().toLocaleLowerCase("pt-BR") ===
        nome.trim().toLocaleLowerCase("pt-BR"),
    )
  )
    throw new Error("Já existe um período com esta identificação.");
  if (!data(inicio) || !data(fim) || inicio > fim)
    throw new Error("Informe datas válidas, com término após o início.");
  if (
    inicioAulas &&
    (!data(inicioAulas) || inicioAulas < inicio || inicioAulas > fim)
  )
    throw new Error("O início das aulas deve estar dentro do semestre.");
}

/** Planeja somente estrutura; jamais aceita coleções de dados de estudantes. */
export function planejarPeriodo(
  input: {
    nome: string;
    inicio: string;
    fim: string;
    inicioAulas?: string;
    modelo?: string;
    status?: "PLANEJADO" | "ATIVO";
  },
  base: {
    periodos: Periodo[];
    turmas: Turma[];
    criterios: CriterioAvaliacao[];
    horarios: HorarioTurma[];
    configAvaliacao?: Record<string,unknown>[];
    rubricasAvaliacao?: Record<string,unknown>[];
    marcos?: import("../types").MarcoAcademico[];
  },
  id: () => string = () => crypto.randomUUID(),
  autor = "",
  agora = new Date().toISOString(),
) {
  if(input.status&&!['PLANEJADO','ATIVO'].includes(input.status))throw new Error('Um novo semestre deve ser planejado ou ativo.');
  validarNovoPeriodo(
    input.nome,
    input.inicio,
    input.fim,
    base.periodos,
    input.inicioAulas,
  );
  const periodo: Periodo = {
    periodo_id: id(),
    nome: input.nome.trim(),
    data_inicio: input.inicio,
    data_fim: input.fim,
    status: input.status || "PLANEJADO",
  };
  if(input.modelo&&!base.periodos.some(p=>p.periodo_id===input.modelo))throw new Error("Período modelo não localizado.");
  const originais = input.modelo
    ? base.turmas.filter((t) => t.periodo_id === input.modelo)
    : [];
  const vinculos = new Map(originais.map((t) => [t.turma_id, id()]));
  const turmas = originais.map((t) => ({
    nome:t.nome,turno:t.turno,disciplina_id:t.disciplina_id,
    turma_id: vinculos.get(t.turma_id)!,
    periodo_id: periodo.periodo_id,
    status: "ATIVO" as const,
  }));
  const disciplinas = new Set(originais.map((t) => t.disciplina_id));
  const vinculosCriterios = new Map<string,string>();
  const criterios = input.modelo
    ? base.criterios
        .filter(
          (c) =>
            c.periodo_id === input.modelo ||
            (!!c.turma_id && vinculos.has(c.turma_id)) ||
            (!c.periodo_id &&
              !c.turma_id &&
              !!c.disciplina_id &&
              disciplinas.has(c.disciplina_id)),
        )
        .filter((c) => !c.turma_id || vinculos.has(c.turma_id))
        .map((c) => {
          const criterioId=id();vinculosCriterios.set(c.criterio_id,criterioId);
          return ({
          disciplina_id:c.disciplina_id,codigo_criterio:c.codigo_criterio,nome:c.nome,nota_maxima:c.nota_maxima,peso:c.peso,ordem:c.ordem,ativo:c.ativo,escopo:c.escopo,fonte_referencia:c.fonte_referencia,criterio_descricao:c.criterio_descricao,escopo_evidencia:c.escopo_evidencia,instrumento:c.instrumento,instrumento_avaliacao:c.instrumento_avaliacao,
          criterio_id: criterioId,
          periodo_id: periodo.periodo_id,
          turma_id: c.turma_id ? vinculos.get(c.turma_id) : c.turma_id,
          status_validacao: "A_CONFERIR",
        });})
    : [];
  const configuracoes: Record<string,unknown>[] = [], rubricas: Record<string,unknown>[] = [];
  const fontesRubricas = (base.rubricasAvaliacao || []).map(linhaParaRubrica);
  const fontesConfigs = (base.configAvaliacao || []).filter(l=>vinculos.has(String(l.turma_id))).map(linhaParaConfig);
  const vigentes = new Map<string,ConfigAvaliacao>();
  for (const {config,problema} of fontesConfigs) {
    if (!config) { if (problema) throw new Error('Configuração do modelo inválida; confira antes de copiar.');continue; }
    if (config.status !== 'aprovada' || !vinculos.has(config.turma_id) || !vinculosCriterios.has(config.criterio_id)) continue;
    const chave = config.turma_id+'|'+config.criterio_id;
    if (!vigentes.has(chave) || vigentes.get(chave)!.versao < config.versao) vigentes.set(chave,config);
  }
  for (const cfg of vigentes.values()) {
    let rubricaId: string | undefined;
    if (cfg.rubrica_id) {
      const fonte = fontesRubricas.map(r=>r.rubrica).filter((r):r is RubricaVersao=>!!r && r.rubrica_id===cfg.rubrica_id && r.status==='aprovada' && r.turma_id===cfg.turma_id && r.criterio_id===cfg.criterio_id).sort((a,b)=>b.versao-a.versao)[0];
      if (!fonte) throw new Error('Rubrica aprovada do modelo não localizada. Nenhuma cópia será iniciada.');
      rubricaId=id();
      rubricas.push(rubricaParaLinha({ ...fonte,rubrica_id:rubricaId,versao:1,criterio_id:vinculosCriterios.get(cfg.criterio_id)!,turma_id:vinculos.get(cfg.turma_id)!,periodo_id:periodo.periodo_id,status:'rascunho',
        subcriterios:fonte.subcriterios.map(s=>({subcriterio_id:s.subcriterio_id,nome:s.nome,peso:s.peso,foco:[...s.foco],descritores:{...s.descritores}})),
        origem:'MODELO_PERIODO',motivo_alteracao:`Modelo de ${input.modelo}; rubrica ${fonte.rubrica_id}, versão ${fonte.versao}.`,criado_em:agora,criado_por:autor,aprovado_em:undefined,aprovado_por:undefined }));
    }
    const config = {denominador:cfg.config.denominador,agregacao:cfg.config.agregacao,regraAtraso:cfg.config.regraAtraso?{regraId:cfg.config.regraAtraso.regraId,valor:cfg.config.regraAtraso.valor,justificativa:cfg.config.regraAtraso.justificativa}:undefined};
    configuracoes.push(configParaLinha({...cfg,config_id:id(),periodo_id:periodo.periodo_id,turma_id:vinculos.get(cfg.turma_id)!,criterio_id:vinculosCriterios.get(cfg.criterio_id)!,rubrica_id:rubricaId,config,versao:1,status:'rascunho',motivo_alteracao:`Modelo de ${input.modelo}, versão ${cfg.versao}.`,criado_em:agora,criado_por:autor,aprovado_em:undefined,aprovado_por:undefined}));
  }
  // Dias e horários são modelos; vigência é explicitamente a do novo semestre.
  const horarios = base.horarios
    .filter((h) => vinculos.has(h.turma_id))
    .map((h) => ({
      horario_id: id(),
      turma_id: vinculos.get(h.turma_id)!,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
      ativo: h.ativo,
      data_inicio: input.inicioAulas || input.inicio,
      data_fim: input.fim,
    }));
  const marcos = input.inicioAulas
    ? [
        {
          marco_id: id(),
          periodo_id: periodo.periodo_id,
          nome: "Início das aulas",
          codigo_marco: "INICIO_AULAS",
          tipo: "OUTRO" as const,
          data_prazo: input.inicioAulas,
          status: "PLANEJADO" as const,
          origem: "CADASTRO_PERIODO",
          escopo_marco: "DISCIPLINA",
        },
      ]
    : [];
  const estruturaCronograma = (input.modelo ? base.marcos || [] : []).filter(m => m.periodo_id === input.modelo && (!m.turma_id || vinculos.has(m.turma_id)) && !(input.inicioAulas && m.codigo_marco === 'INICIO_AULAS' && !m.turma_id)).map(m => ({
    marco_id:id(),periodo_id:periodo.periodo_id,disciplina_id:m.disciplina_id,turma_id:m.turma_id?vinculos.get(m.turma_id):undefined,nome:m.nome,tipo:m.tipo,codigo_marco:m.codigo_marco,
    data_prazo:'',status:'PLANEJADO' as const,origem:'MODELO_PERIODO',escopo_marco:m.escopo_marco,
  }));
  return { periodo, turmas, criterios, horarios, marcos:[...marcos,...estruturaCronograma],configuracoes,rubricas };
}
