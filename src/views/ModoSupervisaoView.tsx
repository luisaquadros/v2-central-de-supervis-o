import { ResumoRssSemEnvio } from '../components/ResumoRssSemEnvio';
import { ResumoDocumentosTurma } from '../components/ResumoDocumentosTurma';
import { diagnosticarChamada } from '../services/aulaParticipants';
import { temSupervisaoHorarioAlternativo, ROTULO_HORARIO_ALTERNATIVO } from '../services/condicoesMatricula';
import { prepararEncerramentoChamada, naoRegistrados, naoConfirmadosRetrospectivos } from '../services/chamadaService';
import { resolverResponsaveis } from '../services/aulaParticipants';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  MessageSquare,
  FileCheck,
  CalendarCheck,
  ChevronRight,
  ArrowLeft,
  X,
  FileText,
  UserCheck,
  Check,
  Smartphone,
  Save,
  RotateCcw,
  Calendar,
  Users,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import {
  ModalNovaOrientacao,
  ModalNovoFeedback,
  ModalRegistrarOcorrencia,
  ModalNovoPontoAcompanhamento,
} from '../components/Modals';
import { getHojeDataIso } from '../services/supervisaoOperacionalService';
import { obterLeiturasAgendadas, obterLacunasRssDaAula } from '../services/supervisaoOperacionalService';
import { Frequencia, MotivoNaoRealizado } from '../types';
import { LeituraRss, CAMPOS_TEXTO_RSS } from '../components/LeituraRss';
import { listarDatasSupervisao } from '../services/historicoAulas';
import { interpretarRegistroFormativo, serializarRegistroFormativo } from '../services/registroFormativo';

interface ModoSupervisaoViewProps {
  turmaId: string;
  dataAulaInicial?: string;
  onEncerrar: () => void;
  onOpenFichaAluno: (matriculaId: string, initialTab?: string) => void;
  onPrepararAula?: (turmaId: string) => void;
}

interface ExcecaoAluno {
  faltou: boolean;
  atraso: boolean;
  celular: boolean;
  justificativa?: string;
  observacao?: string;
}

export const ModoSupervisaoView: React.FC<ModoSupervisaoViewProps> = ({
  turmaId,
  dataAulaInicial,
  onEncerrar,
  onOpenFichaAluno,
  onPrepararAula,
}) => {
  const {
    turmas,
    disciplinas,
    periodos,
    horariosTurma,
    selectedPeriodoId,
    matriculas,
    alunos,
    gruposPratica,
    grupoIntegrantes,
    getAlunosDaTurma,
    getResumoAlunoSupervisao,
    getSituacaoRssEstudante,
    calendarioRss,
    toggleOrientacaoStatus,
    togglePontoStatus,
    leiturasResponsaveis,
    atualizarStatusEstudoDirigido,
    salvarChamadaPorExcecao,
    marcarEncontroNaoRealizado,
    reagendarEncontro,
    encontrosTurma,
    frequencias,
    registrosSemanais,
    orientacoes,
    registrosSupervisao,
    addRegistroSupervisao,
    atualizarRegistroFormativo,
    saveStatus,
    isTokenExpired,
    tokenExpiredAviso,
    reconectarESincronizar,
  } = useSupervisao();

  const turma = turmas.find(t => t.turma_id === turmaId);
  const disciplina = disciplinas.find(d => d.disciplina_id === turma?.disciplina_id);
  const alunosLista = getAlunosDaTurma(turmaId);
  const diagnosticoChamada = diagnosticarChamada(turmaId, matriculas, alunos);
  const chamadaIncompleta = alunosLista.length === 0 || diagnosticoChamada.alunosLocalizados < diagnosticoChamada.matriculasElegiveis;

  // Data do encontro é uma decisão explícita da professora, não o relógio do navegador.
  const [hojeIso, setDataEncontro] = useState(dataAulaInicial || getHojeDataIso());
  useEffect(() => { setDataEncontro(dataAulaInicial || getHojeDataIso()); }, [turmaId, dataAulaInicial]);
  const retrospectivo = hojeIso < getHojeDataIso();
  const dataInvalida = !/^\d{4}-\d{2}-\d{2}$/.test(hojeIso) || hojeIso > getHojeDataIso();
  const [chamadaEditada,setChamadaEditada] = useState(false);
  const periodo = periodos.find(p=>p.periodo_id===selectedPeriodoId);
  const datasAula = useMemo(()=>listarDatasSupervisao(turmaId,horariosTurma,encontrosTurma,
    periodo?.data_inicio || '',periodo?.data_fim || '',getHojeDataIso()),[turmaId,horariosTurma,encontrosTurma,periodo?.data_inicio,periodo?.data_fim]);
  const posicao = datasAula.findIndex(d=>d.data===hojeIso);
  const dataAnterior = datasAula.filter(d=>d.data<hojeIso).at(-1)?.data;
  const dataPosterior = datasAula.find(d=>d.data>hojeIso)?.data;
  const trocarData = (nova: string) => {
    if(nova===hojeIso)return;
    if(chamadaEditada || formularioAlterado) {
      if(!window.confirm('Há alterações nesta aula que ainda não foram salvas. Deseja mudar de data e descartá-las?'))return;
    }
    setChamadaEditada(false);
    setDataEncontro(nova);
  };

  // 1. Verificação de Encontro de Hoje (Cancelado / Reagendado / Realizado)
  const encontroHoje = encontrosTurma.find(
    e => e.turma_id === turmaId && e.data === hojeIso
  );

  // 2. Estudo Dirigido de Hoje programado para esta turma
  const leiturasDaAula = useMemo(() => {
    return obterLeiturasAgendadas(leiturasResponsaveis.filter(l => l.turma_id === turmaId), encontrosTurma)
      .filter(l => l.data_apresentacao === hojeIso);
  }, [leiturasResponsaveis, turmaId, hojeIso, encontrosTurma]);
  const estudoDirigidoHoje = leiturasDaAula.find(l => l.reprogramada) || leiturasDaAula[0];

  // Uma única fonte para múltiplos apresentadores, IDs e textos da planilha.
  const responsaveisEstudo = useMemo(() => estudoDirigidoHoje
    ? resolverResponsaveis({
        leitura: estudoDirigidoHoje,
        matriculas,
        alunos,
        grupos: gruposPratica,
        integrantes: grupoIntegrantes,
      })
    : [], [estudoDirigidoHoje, matriculas, alunos, gruposPratica, grupoIntegrantes]);

  const nomeGrupoEstudo = useMemo(() => {
    if (!estudoDirigidoHoje || !estudoDirigidoHoje.grupo_id) return null;
    const grupo = gruposPratica.find(g => g.grupo_id === estudoDirigidoHoje.grupo_id);
    return grupo ? grupo.nome_grupo || grupo.descricao : null;
  }, [estudoDirigidoHoje, gruposPratica]);

  const renderStatusEstudoBadge = (status?: string) => {
    if (!status) return null;
    let label = status;
    let colorClass = 'bg-slate-100 text-slate-800 border-slate-200';
    if (status === 'PLANEJADO') {
      label = 'Previsto';
      colorClass = 'bg-blue-50 text-blue-800 border-blue-200';
    } else if (status === 'REALIZADO') {
      label = 'Realizado';
      colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (status === 'PARCIAL') {
      label = 'Parcial';
      colorClass = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (status === 'NAO_REALIZADO') {
      label = 'Não Realizado';
      colorClass = 'bg-red-50 text-red-800 border-red-200';
    } else if (status === 'SUBSTITUICAO') {
      label = 'Substituição';
      colorClass = 'bg-purple-50 text-purple-800 border-purple-200';
    }

    return (
      <span className={`inline-block font-bold text-[10px] px-1.5 py-0.5 rounded border ${colorClass} uppercase ml-2`}>
        {label}
      </span>
    );
  };

  // 3. Chamada por Exceção: Estado em memória durante a aula
  // Por padrão: todos presentes (excecoes vazias = presentes).
  // A chamada salva pertence exclusivamente à turma e à data em exibição.
  // Nunca aproveitar as exceções de outra turma quando o componente é reutilizado.
  const construirExcecoesDaTurma = (): Record<string, ExcecaoAluno> => {
    const ids = new Set(alunosLista.map(item => item.matricula.matricula_id));
    const initialMap: Record<string, ExcecaoAluno> = {};
    frequencias.filter(f => f.data_aula === hojeIso && ids.has(f.matricula_id)).forEach(f => {
      const faltou = !['PRESENTE', 'ATRASO'].includes(String(f.status));
      if (faltou || f.atraso || f.celular || f.justificativa || f.observacao) {
        initialMap[f.matricula_id] = {
          faltou,
          atraso: !!f.atraso || String(f.status) === 'ATRASO',
          celular: !!f.celular,
          justificativa: f.justificativa || '',
          observacao: f.observacao || '',
        };
      }
    });
    return initialMap;
  };
  const [excecoes, setExcecoes] = useState<Record<string, ExcecaoAluno>>(construirExcecoesDaTurma);
  const [confirmadosRetro, setConfirmadosRetro] = useState<Record<string, boolean>>({});
  // Refaz o formulário quando a turma muda; não reseta alterações do usuário
  // durante a sincronização normal da mesma turma.
  useEffect(() => {
    setExcecoes(construirExcecoesDaTurma());
    const previamenteGravadas = new Set(frequencias.filter(f => f.data_aula === hojeIso).map(f => f.matricula_id));
    setConfirmadosRetro(Object.fromEntries(alunosLista.filter(x => previamenteGravadas.has(x.matricula.matricula_id)).map(x => [x.matricula.matricula_id, true])));
    setSearchQuery('');
    setChamadaSalvaMsg(null);
    setChamadaEditada(false);
  }, [turmaId, hojeIso]);

  const [chamadaSalvaMsg, setChamadaSalvaMsg] = useState<{
    texto: string;
    tipo: 'remoto' | 'local';
    tokenExpirado?: boolean;
  } | null>(null);
  const [mobileTab, setMobileTab] = useState<'LISTA' | 'DETALHE'>('LISTA');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatriculaId, setSelectedMatriculaId] = useState<string>(() => {
    return alunosLista.length > 0 ? alunosLista[0].matricula.matricula_id : '';
  });
  const [participacao, setParticipacao] = useState('NAO_REGISTRADO');
  const [leituraDirigida, setLeituraDirigida] = useState('NAO_REGISTRADO');
  const [casoCompartilhado, setCasoCompartilhado] = useState('NAO_REGISTRADO');
  const [observacaoFormativa, setObservacaoFormativa] = useState('');
  const [registrandoParticipacao, setRegistrandoParticipacao] = useState(false);
  const [erroParticipacao, setErroParticipacao] = useState('');
  const [formularioAlterado, setFormularioAlterado] = useState(false);
  const registroFormativoAnterior = registrosSupervisao.find(r => r.matricula_id === selectedMatriculaId && String(r.data_hora || '').slice(0,10) === hojeIso && r.categoria === 'PARTICIPACAO_AULA');
  useEffect(() => {
    const base = interpretarRegistroFormativo(registroFormativoAnterior?.texto || '');
    setParticipacao(base.participacao); setLeituraDirigida(base.leituraDirigida);
    setCasoCompartilhado(base.casoCompartilhado); setObservacaoFormativa(base.observacao);
    setFormularioAlterado(false); setErroParticipacao('');
  }, [selectedMatriculaId,hojeIso,registroFormativoAnterior?.registro_id]);
  const registrarParticipacao = async () => {
    if (!selectedMatriculaId || registrandoParticipacao || (participacao === 'NAO_REGISTRADO' && leituraDirigida === 'NAO_REGISTRADO' && casoCompartilhado === 'NAO_REGISTRADO' && !observacaoFormativa.trim())) return;
    setRegistrandoParticipacao(true); setErroParticipacao('');
    try {
      const texto = serializarRegistroFormativo({participacao,leituraDirigida,casoCompartilhado,observacao:observacaoFormativa});
      if (registroFormativoAnterior?.registro_id) await atualizarRegistroFormativo(registroFormativoAnterior.registro_id,texto);
      else await addRegistroSupervisao(selectedMatriculaId, hojeIso + 'T12:00:00', 'PARTICIPACAO_AULA', texto);
      setFormularioAlterado(false);
      setErroParticipacao('Registro armazenado. Confira no indicador de sincronização se já foi enviado à planilha.');
    } catch (e: any) { setErroParticipacao(e?.message || 'Não foi possível gravar.'); }
    finally { setRegistrandoParticipacao(false); }
  };

  // Ao concluir a leitura assíncrona da planilha, a lista pode chegar depois
  // de abrir a aula. Evita ficha vazia e seleção de matrícula de outra turma.
  useEffect(() => {
    if (alunosLista.length === 0) {
      if (selectedMatriculaId) setSelectedMatriculaId('');
      setMobileTab('LISTA');
      return;
    }
    if (!alunosLista.some(item => item.matricula.matricula_id === selectedMatriculaId)) {
      setSelectedMatriculaId(alunosLista[0].matricula.matricula_id);
    }
  }, [turmaId, alunosLista, selectedMatriculaId]);

  // Modals operacionais
  const [modalType, setModalType] = useState<
    'orientacao' | 'feedback' | 'atraso' | 'ocorrencia' | 'ponto' | 'naoRealizada' | 'reagendar' | 'maisExcecao' | null
  >(null);
  const [matriculaParaMais, setMatriculaParaMais] = useState<string>('');

  // Estados dos formulários de aula não realizada / reagendamento
  const [motivoNaoRealizada, setMotivoNaoRealizada] = useState<MotivoNaoRealizado>('Cancelamento institucional');
  const [obsNaoRealizada, setObsNaoRealizada] = useState('');
  const [novaDataReagendada, setNovaDataReagendada] = useState('');
  const [novoHorarioReagendado, setNovoHorarioReagendado] = useState('');
  const [motivoReagendamento, setMotivoReagendamento] = useState('');
  const [transferirEstudoCheck, setTransferirEstudoCheck] = useState(true);

  // Estado para seleção de substituição de estudo dirigido
  const [modoSubstituicao, setModoSubstituicao] = useState(false);
  const [alunoSubstitutoId, setAlunoSubstitutoId] = useState('');
  const [motivoSubstituicao, setMotivoSubstituicao] = useState('');

  // Helper de exceções
  const toggleFaltou = (matriculaId: string) => {
    setChamadaEditada(true);
    if (retrospectivo) setConfirmadosRetro(prev => ({ ...prev, [matriculaId]: true }));
    setExcecoes(prev => {
      const atual = prev[matriculaId] || { faltou: false, atraso: false, celular: false };
      return {
        ...prev,
        [matriculaId]: {
          ...atual,
          faltou: !atual.faltou,
        },
      };
    });
  };

  const toggleAtraso = (matriculaId: string) => {
    setChamadaEditada(true);
    if (retrospectivo) setConfirmadosRetro(prev => ({ ...prev, [matriculaId]: true }));
    setExcecoes(prev => {
      const atual = prev[matriculaId] || { faltou: false, atraso: false, celular: false };
      return {
        ...prev,
        [matriculaId]: {
          ...atual,
          atraso: !atual.atraso,
        },
      };
    });
  };

  const toggleCelular = (matriculaId: string) => {
    setChamadaEditada(true);
    setExcecoes(prev => {
      const atual = prev[matriculaId] || { faltou: false, atraso: false, celular: false };
      return {
        ...prev,
        [matriculaId]: {
          ...atual,
          celular: !atual.celular,
        },
      };
    });
  };

  // Encerrar chamada (D1): primeiro a prévia; a gravação só acontece após a confirmação explícita.
  const [previaAberta, setPreviaAberta] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const previa = prepararEncerramentoChamada(alunosLista, excecoes);
  const abrirPrevia = () => {
    if (dataInvalida) { setChamadaSalvaMsg({texto: 'Escolha uma data de aula válida (não futura).', tipo: 'local'}); return; }
    if (retrospectivo && naoConfirmadosRetrospectivos(alunosLista, confirmadosRetro, retrospectivo).length > 0) {
      setChamadaSalvaMsg({texto: 'Chamada retrospectiva: confirme Presente ou Falta/Atraso individualmente. Nunca presumimos presença em uma aula anterior.', tipo: 'local'});
      return;
    }
    if (chamadaIncompleta) {
      setChamadaSalvaMsg({ texto: 'Chamada não encerrada: lista de alunos incompleta. Confira a sincronização da turma.', tipo: 'local' });
      return;
    }
    setPreviaAberta(true);
  };
  const handleSalvarChamada = async () => {
    if (encerrando) return; // evita cliques repetidos e registros duplicados
    setEncerrando(true);
    try {
      const res = await salvarChamadaPorExcecao(turmaId, hojeIso, previa.registros);
      setPreviaAberta(false);
      setChamadaEditada(false);
      setChamadaSalvaMsg({
        texto: `${res.statusTexto} — ${previa.presentes.length} presentes, ${previa.faltas.length} falta(s).`,
        tipo: res.sincronizadoRemoto ? 'remoto' : 'local',
        tokenExpirado: res.tokenExpirado,
      });
      setTimeout(() => setChamadaSalvaMsg(null), 6000);
    } finally { setEncerrando(false); }
  };

  // Contagem instantânea em memória
  const excecoesDaTurma = alunosLista.map(item => excecoes[item.matricula.matricula_id]).filter((e): e is ExcecaoAluno => !!e);
  const faltasCount = excecoesDaTurma.filter(e => e.faltou).length;
  const coletivos = alunosLista.filter(item => !temSupervisaoHorarioAlternativo(item.matricula));
  const alternativos = alunosLista.length - coletivos.length;
  const semMarcacao = naoRegistrados(alunosLista, excecoes).filter(i => !temSupervisaoHorarioAlternativo(i.matricula)).length;
  const atrasosCount = excecoesDaTurma.filter(e => e.atraso).length;
  const celularCount = excecoesDaTurma.filter(e => e.celular).length;

  // Filtro de alunos
  const filteredAlunos = alunosLista.filter(item =>
    item.aluno.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // RSS: diagnóstico somente na aula. Um grupo corresponde a uma unidade
  // de envio, embora todas as integrantes possam ver as mesmas semanas.
  const rssPorAluno = new Map(alunosLista.map(item => [
    item.matricula.matricula_id,
    obterLacunasRssDaAula(getSituacaoRssEstudante(item.matricula.matricula_id), calendarioRss, hojeIso),
  ]));
  const pendenciasRssTurma = new Map<string, { nome: string; faltantes: number[]; revisao: number[] }>();
  alunosLista.forEach(item => {
    const vinculo = grupoIntegrantes.find(gi => gi.matricula_id === item.matricula.matricula_id &&
      gruposPratica.some(g => g.grupo_id === gi.grupo_id && g.turma_id === turmaId));
    const grupo = vinculo ? gruposPratica.find(g => g.grupo_id === vinculo.grupo_id) : undefined;
    const chave = grupo ? grupo.grupo_id : item.matricula.matricula_id;
    const lacunas = rssPorAluno.get(item.matricula.matricula_id);
    if (lacunas && lacunas.faltantes.length && !pendenciasRssTurma.has(chave)) {
      pendenciasRssTurma.set(chave, {
        nome: grupo ? (grupo.nome_grupo || 'Grupo de prática') : item.aluno.nome,
        faltantes: lacunas.faltantes, revisao: lacunas.emRevisao,
      });
    }
  });
  const resumoAluno = selectedMatriculaId ? getResumoAlunoSupervisao(selectedMatriculaId) : null;
  // RSS de grupo e individual pertencem à mesma unidade pedagógica, sem somar cópias.
  const gruposDoAluno = new Set(grupoIntegrantes.filter(g => g.matricula_id === selectedMatriculaId && String(g.status).toUpperCase() === 'ATIVO').map(g => g.grupo_id));
  const rssDoAluno = registrosSemanais.filter(r => {
    const x = r as unknown as Record<string, unknown>;
    if (x.turma_id && x.turma_id !== turmaId) return false;
    return r.matricula_id === selectedMatriculaId || gruposDoAluno.has(String(x.grupo_id || ''));
  });
  const ultimoRss = [...rssDoAluno].filter(r => {
    const x = r as unknown as Record<string, unknown>;
    const temConteudo = CAMPOS_TEXTO_RSS.some(([ch]) => String(x[ch] ?? '').trim()) ||
      ['link','url','link_documento','url_documento','link_rss','arquivo_url','documento_url'].some(ch => /^https:\/\//.test(String(x[ch] || '')));
    const entregueAteEncontro = !r.data_entrega || r.data_entrega.slice(0,10) <= hojeIso;
    return temConteudo && entregueAteEncontro && String(r.status || '').toUpperCase() !== 'FALTANTE';
  }).sort((a,b) => String(b.data_entrega || '').localeCompare(String(a.data_entrega || '')) || Number((b as any).semana_rss ?? b.semana ?? 0) - Number((a as any).semana_rss ?? a.semana ?? 0))[0];
  const diasUltimoRss = ultimoRss?.data_entrega && /^\d{4}-\d{2}-\d{2}/.test(ultimoRss.data_entrega)
    ? Math.floor((Date.parse(hojeIso + 'T12:00:00Z') - Date.parse(ultimoRss.data_entrega.slice(0,10) + 'T12:00:00Z')) / 86400000) : null;
  const orientacoesAnteriores = orientacoes.filter(o => o.matricula_id === selectedMatriculaId && o.data_hora?.slice(0,10) < hojeIso)
    .sort((a,b) => String(b.data_hora).localeCompare(String(a.data_hora)));
  const registrosAulaAnterior = registrosSupervisao.filter(r => r.matricula_id === selectedMatriculaId && String(r.data_hora || '').slice(0,10) < hojeIso)
    .sort((a,b) => String(b.data_hora).localeCompare(String(a.data_hora)));

  return (
    <div className="flex flex-col min-h-0 md:h-[calc(100dvh-2.5rem)] -m-4 sm:-m-6 bg-slate-100 font-sans max-md:overflow-y-auto md:overflow-hidden">
      {/* 1. TOP HEADER DE NAVEGAÇÃO E AÇÕES RÁPIDAS DA AULA */}
      <header className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onEncerrar}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Encerrar Modo Supervisão"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                Modo Supervisão
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {disciplina?.nome} · Turno {turma?.turno}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5">{turma?.nome}</h2>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs font-semibold text-white min-w-[250px]">
          <span>Encontro · confirmar data</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Encontro anterior" title="Encontro anterior" disabled={!dataAnterior}
              onClick={()=>dataAnterior&&trocarData(dataAnterior)} className="min-h-10 px-2 rounded-lg bg-slate-700 disabled:opacity-40">‹</button>
            <input type="date" aria-label="Data do encontro de supervisão" max={getHojeDataIso()} value={hojeIso} onChange={e => trocarData(e.target.value)}
              className="min-h-10 flex-1 min-w-[145px] rounded-lg px-2 text-slate-900 bg-white border border-slate-300" />
            <button type="button" aria-label="Próximo encontro" title="Próximo encontro" disabled={!dataPosterior}
              onClick={()=>dataPosterior&&trocarData(dataPosterior)} className="min-h-10 px-2 rounded-lg bg-slate-700 disabled:opacity-40">›</button>
          </div>
          <select aria-label="Histórico de encontros" value={posicao<0?'':hojeIso} onChange={e=>e.target.value&&trocarData(e.target.value)}
            className="min-h-10 px-2 rounded-lg bg-white text-slate-900 border border-slate-300" >
            <option value="">Selecionar encontro do semestre</option>
            {datasAula.map(d=><option key={d.data} value={d.data}>{d.data.split('-').reverse().join('/')} · {d.situacao}</option>)}
          </select>
          {retrospectivo && <span className="text-amber-200 text-[11px]">Registro retrospectivo · validar presenças</span>}
          {chamadaEditada && <span className="text-amber-200 text-[11px]">Chamada alterada, ainda não salva</span>}
        </div>
        {/* Ações operacionais da aula: Não realizada, Reagendar, Encerrar */}
        <div className="flex items-center gap-2 flex-wrap">
          {onPrepararAula && <button
            onClick={() => onPrepararAula(turmaId)}
            className="px-3 py-2 rounded-lg bg-indigo-200 text-slate-950 font-semibold text-xs hover:bg-indigo-100"
          >Preparar aula</button>}
          <button
            onClick={() => setModalType('naoRealizada')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium transition-colors cursor-pointer border border-slate-700"
            title="Registrar que esta aula não ocorreu (feriado, cancelamento, etc.)"
          >
            Marcar não realizada
          </button>

          <button
            onClick={() => setModalType('reagendar')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer border border-slate-700"
            title="Reagendar supervisão para outra data"
          >
            Reagendar
          </button>

          <button
            onClick={onEncerrar}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Encerrar
          </button>
        </div>
      </header>

      {/* AVISO DE AULA NÃO REALIZADA / FERIADO (SE APLICÁVEL) */}
      {encontroHoje && encontroHoje.status === 'NAO_REALIZADO' && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Atenção:</strong> Esta aula está registrada como <strong>NÃO REALIZADA</strong> (
              {encontroHoje.motivo_nao_realizado}). Não serão geradas faltas ou chamada pendente.
            </span>
          </div>
          <span className="font-mono text-[11px] text-amber-800">
            {encontroHoje.observacao || ''}
          </span>
        </div>
      )}

      <div className="px-4 pt-2 shrink-0"><ResumoRssSemEnvio turmaId={turmaId} compacto /></div>
      <div className="px-4 pt-2 shrink-0"><ResumoDocumentosTurma turmaId={turmaId} compacto /></div>

      {/* 2. TOPO DO MODO SUPERVISÃO: ESTUDO DIRIGIDO / LEITURA DE HOJE */}
      {estudoDirigidoHoje && (
        <section className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 shrink-0 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start md:items-center gap-2.5">
              <span className="bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] uppercase shrink-0">
                Estudo Dirigido Hoje
              </span>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900">
                    {estudoDirigidoHoje.tema || estudoDirigidoHoje.artigo_leitura || 'Apresentação de Artigo / Caso'}
                  </span>
                  {estudoDirigidoHoje.artigo_leitura && estudoDirigidoHoje.tema && (
                    <span className="text-slate-600 font-medium">
                      · {estudoDirigidoHoje.artigo_leitura}
                    </span>
                  )}
                  {renderStatusEstudoBadge(estudoDirigidoHoje.status_realizacao)}
                </div>

                {estudoDirigidoHoje.reprogramada && (
                  <div className="text-[11px] font-semibold text-amber-800 mt-1">
                    Apresentação transferida da aula cancelada de {estudoDirigidoHoje.data_original.split('-').reverse().join('/')} para hoje.
                    Os responsáveis originais permanecem vinculados.
                  </div>
                )}
                {leiturasDaAula.length > 1 && (
                  <div className="mt-2 space-y-2">
                    <p className="font-bold text-xs text-amber-900">{leiturasDaAula.length} leituras programadas para hoje:</p>
                    {leiturasDaAula.map((leitura, i) => {
                      const responsaveis = resolverResponsaveis({
                        leitura, matriculas, alunos, grupos: gruposPratica, integrantes: grupoIntegrantes,
                      });
                      return (
                        <div key={leitura.leitura_id || String(i)} className="rounded-lg border border-amber-200 bg-white/80 p-2 text-xs">
                          <p className="font-semibold text-slate-900">{i + 1}. {leitura.tema || leitura.titulo || leitura.artigo_leitura || 'Estudo dirigido'}</p>
                          <p className="mt-1 text-slate-700"><strong>Responsáveis:</strong> {responsaveis.map(p => p.nome).join(', ') || 'Sem vínculo identificado na base'}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {nomeGrupoEstudo && (
                  <div className="text-slate-800 font-semibold mt-0.5 text-[11px]">
                    Grupo: <span className="underline">{nomeGrupoEstudo}</span>
                  </div>
                )}

                {responsaveisEstudo.length > 0 ? (
                  <div className="mt-1 text-[11px] text-slate-700">
                    <span className="font-bold">Responsáveis: </span>
                    <span className="inline-flex gap-2.5 flex-wrap mt-0.5">
                      {responsaveisEstudo.map(resp => (
                        <span key={resp.matriculaId + '-' + resp.nome} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-900 font-medium flex items-center gap-1">
                          {resp.nome}
                          {resp.papel && <span className="text-slate-400 font-normal text-[10px]">({resp.papel})</span>}
                          {resp.tipo === 'SUBSTITUTO' && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1 rounded uppercase scale-90">Substituto</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 mt-1">
                    Nenhum responsável vinculado na base oficial para este estudo dirigido.
                  </div>
                )}

                {estudoDirigidoHoje.motivo_substituicao && (
                  <div className="mt-1 text-[11px] text-purple-700 italic">
                    Motivo da substituição: {estudoDirigidoHoje.motivo_substituicao}
                  </div>
                )}
              </div>
            </div>

            {/* Controles Rápidos: Realizado, Parcial, Não realizado, Substituição */}
            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
              <button
                onClick={() =>
                  atualizarStatusEstudoDirigido(
                    estudoDirigidoHoje.leitura_id || estudoDirigidoHoje.data || '',
                    'REALIZADO'
                  )
                }
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  estudoDirigidoHoje.status_realizacao === 'REALIZADO'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                }`}
              >
                ✓ Realizado
              </button>

              <button
                onClick={() =>
                  atualizarStatusEstudoDirigido(
                    estudoDirigidoHoje.leitura_id || estudoDirigidoHoje.data || '',
                    'PARCIAL'
                  )
                }
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  estudoDirigidoHoje.status_realizacao === 'PARCIAL'
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-900'
                }`}
              >
                Parcial
              </button>

              <button
                onClick={() =>
                  atualizarStatusEstudoDirigido(
                    estudoDirigidoHoje.leitura_id || estudoDirigidoHoje.data || '',
                    'NAO_REALIZADO'
                  )
                }
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  estudoDirigidoHoje.status_realizacao === 'NAO_REALIZADO'
                    ? 'bg-red-700 text-white'
                    : 'bg-red-100 hover:bg-red-200 text-red-900'
                }`}
              >
                Não realizado
              </button>

              <button
                onClick={() => setModoSubstituicao(!modoSubstituicao)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                  estudoDirigidoHoje.status_realizacao === 'SUBSTITUICAO'
                    ? 'bg-purple-700 text-white border-purple-800'
                    : 'bg-white hover:bg-purple-50 text-purple-900 border-purple-200'
                }`}
              >
                Substituição
              </button>
            </div>
          </div>

          {/* Inline Quick Selector de Substituição */}
          {modoSubstituicao && (
            <div className="mt-2.5 pt-2 border-t border-amber-200 flex flex-wrap items-center gap-2 text-xs bg-amber-100/50 p-2 rounded-lg">
              <span className="font-semibold text-slate-800">Quem apresentou no lugar?</span>
              <select
                value={alunoSubstitutoId}
                onChange={e => setAlunoSubstitutoId(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 bg-white text-xs text-slate-800"
              >
                <option value="">Selecione o estudante que apresentou...</option>
                {alunosLista.map(item => (
                  <option key={item.matricula.matricula_id} value={item.matricula.matricula_id}>
                    {item.aluno.nome} ({item.aluno.identificador_academico})
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={motivoSubstituicao}
                onChange={e => setMotivoSubstituicao(e.target.value)}
                placeholder="Motivo da substituição (opcional)..."
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 flex-1 min-w-[180px]"
              />

              <button
                onClick={() => {
                  if (alunoSubstitutoId) {
                    const subMat = alunosLista.find(a => a.matricula.matricula_id === alunoSubstitutoId);
                    const subNome = subMat ? subMat.aluno.nome : 'Colega';
                    atualizarStatusEstudoDirigido(
                      estudoDirigidoHoje.leitura_id || estudoDirigidoHoje.data || '',
                      'SUBSTITUICAO',
                      [alunoSubstitutoId],
                      `Apresentado por ${subNome}${motivoSubstituicao ? ` (${motivoSubstituicao})` : ''}`
                    );
                    setModoSubstituicao(false);
                  }
                }}
                disabled={!alunoSubstitutoId}
                className="px-3 py-1 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded font-semibold text-xs cursor-pointer"
              >
                Salvar Substituição
              </button>
              <button
                onClick={() => setModoSubstituicao(false)}
                className="text-slate-500 hover:text-slate-800 text-xs underline cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}
        </section>
      )}

      {/* ALERTA DE TOKEN OAUTH EXPIRADO DURANTE A SUPERVISÃO */}
      {isTokenExpired && (
        <div className="bg-amber-600 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-200" />
            <span>Sessão do Google expirada durante a supervisão. Nenhum dado foi perdido (estão preservados localmente).</span>
          </div>
          <button
            onClick={() => reconectarESincronizar()}
            className="px-3.5 py-1.5 rounded-lg bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
          >
            Reconectar e Sincronizar
          </button>
        </div>
      )}

      {/* FEEDBACK DE CHAMADA SALVA */}
      {previaAberta && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-previa-chamada" data-testid="previa-chamada">
          <div className="bg-white w-full sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl">
            <div className="p-4 border-b border-slate-200">
              <h2 id="titulo-previa-chamada" className="text-base font-bold text-slate-900">Encerrar a chamada?</h2>
              <p className="text-xs text-slate-600 mt-1">Confira quem será registrado. Quem não foi marcado entra como <b>presente</b> somente se você confirmar aqui.</p>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto text-xs">
              <section>
                <h3 className="font-bold text-emerald-800">Serão registrados como presentes ({previa.presentes.length})</h3>
                <p className="text-slate-700 leading-relaxed">{previa.presentes.length ? previa.presentes.map(i => i.aluno.nome + (previa.atrasos.includes(i) ? ' (atraso)' : '')).join(', ') : 'Ninguém.'}</p>
              </section>
              <section>
                <h3 className="font-bold text-red-800">Faltas e justificativas ({previa.faltas.length})</h3>
                <p className="text-slate-700 leading-relaxed">{previa.faltas.length ? previa.faltas.map(f => `${f.item.aluno.nome} — ${f.status === 'JUSTIFICATIVA_PENDENTE' ? 'justificativa a avaliar' : 'sem justificativa'}`).join('; ') : 'Nenhuma.'}</p>
              </section>
              {previa.semRegistro.length > 0 && (
                <section>
                  <h3 className="font-bold text-indigo-800">{ROTULO_HORARIO_ALTERNATIVO}: nada será registrado ({previa.semRegistro.length})</h3>
                  <p className="text-slate-700 leading-relaxed">{previa.semRegistro.map(i => i.aluno.nome).join(', ')}</p>
                </section>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={() => setPreviaAberta(false)} disabled={encerrando} className="min-h-[48px] px-4 rounded-xl border border-slate-300 text-slate-800 font-semibold">Voltar e ajustar</button>
              <button type="button" autoFocus onClick={() => void handleSalvarChamada()} disabled={encerrando} className="min-h-[48px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold disabled:opacity-60">
                {encerrando ? 'Gravando…' : 'Confirmar e encerrar chamada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {chamadaSalvaMsg && (
        <div
          className={`text-white text-xs px-4 py-2.5 flex items-center justify-between shadow-xs shrink-0 ${
            chamadaSalvaMsg.tipo === 'remoto' ? 'bg-emerald-600' : 'bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {chamadaSalvaMsg.tipo === 'remoto' ? (
              <Check className="w-4 h-4 text-emerald-200" />
            ) : (
              <Clock className="w-4 h-4 text-amber-300" />
            )}
            <span className="font-semibold">{chamadaSalvaMsg.texto}</span>
          </div>
          <div className="flex items-center gap-2">
            {chamadaSalvaMsg.tokenExpirado && (
              <button
                onClick={() => reconectarESincronizar()}
                className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 cursor-pointer text-[11px]"
              >
                Reconectar Agora
              </button>
            )}
            <button onClick={() => setChamadaSalvaMsg(null)} className="text-white hover:opacity-80">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SELETOR MOBILE: CHAMADA VS FICHA DO ALUNO */}
      <div className="flex md:hidden bg-slate-200 p-1 border-b border-slate-300 shrink-0">
        <button
          onClick={() => setMobileTab('LISTA')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'LISTA'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>Chamada ({alunosLista.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('DETALHE')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'DETALHE'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span>Ficha do Aluno</span>
        </button>
      </div>

      {/* 3. MAIN SPLIT SCREEN: LISTA DE ALUNOS COM CHAMADA POR EXCEÇÃO (35%) / DETALHES DO ALUNO (65%) */}
      <div className="flex-1 min-h-[420px] md:min-h-0 flex flex-col md:flex-row max-md:overflow-visible md:overflow-hidden">
        {/* COLUNA ESQUERDA: CHAMADA POR EXCEÇÃO + LISTA RÁPIDA (Tablet 35%) */}
        <div className={`w-full md:w-[380px] lg:w-[420px] bg-white border-r border-slate-200 flex-col shrink-0 min-h-[420px] md:min-h-0 max-md:overflow-visible md:overflow-hidden ${mobileTab === 'DETALHE' ? 'hidden md:flex' : 'flex'}`}>
          {/* HEADER DA CHAMADA: RESUMO E BOTÃO DE SALVAMENTO */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-900 text-xs">Chamada por Exceção</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                <span className="text-slate-700 font-semibold" title="Quem não foi marcado só é registrado como presente ao encerrar a chamada, depois da sua confirmação.">{semMarcacao} sem marcação (não registrados)</span> ·{' '}
                <span className={faltasCount > 0 ? 'text-red-700 font-semibold' : 'text-slate-400'}>
                  {faltasCount} falta(s)
                </span>
                {alternativos > 0 && ` · ${alternativos} em horário alternativo (sem presença automática)`}
                {atrasosCount > 0 && ` · ${atrasosCount} atraso`}
                {celularCount > 0 && ` · ${celularCount} celular`}
              </p>
            </div>

            <button
              onClick={abrirPrevia}
              disabled={saveStatus === 'SALVANDO' || chamadaIncompleta}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Revisar quem será considerado presente e encerrar a chamada"
            >
              <Save className="w-4 h-4" />
              <span>Encerrar chamada</span>
            </button>
          </div>

          {chamadaIncompleta && (
            <div role="alert" className="p-3 border-b border-amber-300 bg-amber-50 text-amber-950 text-xs space-y-2">
              <p className="font-bold">A lista desta turma está incompleta. O salvamento da chamada foi bloqueado para evitar presença incorreta.</p>
              <p>{diagnosticoChamada.alunosLocalizados} estudantes identificados de {diagnosticoChamada.matriculasElegiveis} matrículas elegíveis na turma.</p>
              <button type="button" onClick={() => void reconectarESincronizar()} className="underline font-semibold">Atualizar dados da planilha</button>
            </div>
          )}
          {/* O RSS fica acessível na aula, sem acionar o sino de notificações. */}
          {pendenciasRssTurma.size > 0 && (
            <details className="px-3 py-2 border-b border-slate-200 bg-amber-50/90 text-xs">
              <summary className="cursor-pointer text-amber-800 font-semibold">
                RSS não entregues nesta turma ({pendenciasRssTurma.size} {pendenciasRssTurma.size === 1 ? 'unidade' : 'unidades'})
              </summary>
              <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5">
                {[...pendenciasRssTurma.entries()].map(([id,info]) => <div key={id} className="text-slate-800">
                  <span className="font-semibold">{info.nome}:</span>
                  {info.faltantes.length > 0 && ` RSS não entregue nas semanas ${info.faltantes.join(', ')}.`}
                </div>)}
              </div>
            </details>
          )}
          {/* BUSCA RÁPIDA DE ALUNO */}
          <div className="p-2.5 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar aluno na turma..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* LISTA COMPACTA COM CONTROLES RÁPIDOS POR EXCEÇÃO: [Faltou] [Atraso] [Celular] [+] */}
          <div className="flex-1 min-h-[280px] md:min-h-0 max-md:overflow-visible md:overflow-y-auto overscroll-contain touch-pan-y divide-y divide-slate-100 [-webkit-overflow-scrolling:touch]">
            {filteredAlunos.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum aluno encontrado nesta turma.
              </div>
            ) : (
              filteredAlunos.map(item => {
                const matId = item.matricula.matricula_id;
                const isSelected = matId === selectedMatriculaId;
                const exc = excecoes[matId] || { faltou: false, atraso: false, celular: false };
                const resumo = getResumoAlunoSupervisao(matId);
                const hasAlert = resumo?.temAtencao;
                const rss = rssPorAluno.get(matId);

                return (
                  <div
                    key={matId}
                    className={`p-2.5 flex items-center justify-between gap-2 transition-colors select-none ${
                      isSelected ? 'bg-slate-100 border-l-4 border-slate-900' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Aluno Nome + Indicador */}
                    <button
                      onClick={() => {
                        setSelectedMatriculaId(matId);
                        setMobileTab('DETALHE');
                      }}
                      className="text-left flex-1 min-w-0 cursor-pointer pr-1 py-1"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`text-xs font-semibold truncate ${
                            exc.faltou ? 'line-through text-red-700' : 'text-slate-900'
                          }`}
                        >
                          {item.aluno.nome}
                        </span>
                        {temSupervisaoHorarioAlternativo(item.matricula) && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 shrink-0" title="Os encontros coletivos desta turma não geram presença nem falta automática para esta matrícula.">
                            {ROTULO_HORARIO_ALTERNATIVO}
                          </span>
                        )}
                        {hasAlert && (
                          <span
                            className="text-amber-500 font-bold text-xs shrink-0 cursor-help"
                            title={`${resumo?.motivosAtencao.length || 0} pendências:\n${resumo?.motivosAtencao.map(m => `· ${m}`).join('\n') || ''}`}
                          >
                            ⚠
                          </span>
                        )}
                      </div>
                      {rss && rss.faltantes.length > 0 && (
                        <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                          {rss.faltantes.length > 0 && `RSS não entregue (semanas): ${rss.faltantes.join(', ')}`}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {item.aluno.identificador_academico}
                        {exc.justificativa && (
                          <span className="text-blue-600 ml-1">· Justificada</span>
                        )}
                        {exc.observacao && (
                          <span className="text-slate-500 ml-1">· Obs: {exc.observacao}</span>
                        )}
                      </div>
                    </button>

                    {/* CONTROLES RÁPIDOS DE EXCEÇÃO: [Faltou] [Atraso] [Celular] [+] (Áreas mínimas de 44px) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {retrospectivo && !temSupervisaoHorarioAlternativo(item.matricula) && <button type="button"
                        onClick={() => { setConfirmadosRetro(p => ({ ...p, [matId]: true })); setExcecoes(p => ({ ...p, [matId]: { ...(p[matId] || {faltou:false,atraso:false,celular:false}), faltou:false, atraso:false } })); }}
                        className={'min-h-[44px] px-2 rounded-lg text-xs font-bold ' + (confirmadosRetro[matId] && !exc.faltou ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700')}
                        aria-label={'Confirmar presença retrospectiva de ' + item.aluno.nome}>Presente</button>}
                      {/* [Faltou] */}
                      <button
                        onClick={() => toggleFaltou(matId)}
                        className={`min-h-[44px] min-w-[52px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                          exc.faltou
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700'
                        }`}
                        title="Marcar falta para este aluno"
                      >
                        {exc.faltou ? 'FALTA' : 'Faltou'}
                      </button>

                      {/* [Atraso] */}
                      <button
                        onClick={() => toggleAtraso(matId)}
                        className={`min-h-[44px] min-w-[44px] p-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center ${
                          exc.atraso
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-700'
                        }`}
                        title="Registrar atraso"
                      >
                        <Clock className="w-4 h-4" />
                      </button>

                      {/* [Celular] */}
                      <button
                        onClick={() => toggleCelular(matId)}
                        className={`min-h-[44px] min-w-[44px] p-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center ${
                          exc.celular
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-700'
                        }`}
                        title="Registrar uso de smartphone durante aula"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>

                      {/* [+] Mais opções: justificativa, observação */}
                      <button
                        onClick={() => {
                          setMatriculaParaMais(matId);
                          setModalType('maisExcecao');
                        }}
                        className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer flex items-center justify-center"
                        title="Adicionar justificativa ou observação"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: FICHA RESUMIDA DO ALUNO SELECIONADO (65%) */}
        <div className={`flex-1 min-h-[420px] md:min-h-0 bg-slate-50 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-4 md:p-6 space-y-4 ${mobileTab === 'LISTA' ? 'hidden md:block' : 'block'}`}>
          {!resumoAluno ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Selecione um aluno na coluna à esquerda para visualizar sua ficha e registrar orientações.
            </div>
          ) : (
            <div className="max-w-4xl space-y-4">
              {/* CABEÇALHO DO ALUNO */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      {resumoAluno.aluno.nome}
                    </h3>
                    <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {resumoAluno.aluno.identificador_academico}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {resumoAluno.turma.nome} · {resumoAluno.disciplina.nome}
                  </p>
                </div>

                <button
                  onClick={() => onOpenFichaAluno(resumoAluno.matricula.matricula_id, 'resumo')}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <span>Abrir Ficha Completa</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => onOpenFichaAluno(resumoAluno.matricula.matricula_id, 'registros')}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors"
                >
                  Ler todos os RSS deste estudante
                </button>
              </div>

              {/* ÚLTIMO RSS REGISTRADO: abre o conteúdo diretamente, sem navegar para a ficha. */}
              <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2" aria-label="Último RSS preenchido">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-900">Último RSS preenchido</h4>
                  <span className="text-xs text-slate-700 font-semibold">{resumoAluno.totalRegistrosEntregues} de {resumoAluno.totalRegistrosEsperados} esperados até hoje</span>
                </div>
                {ultimoRss ? <>
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    <span className="font-semibold text-slate-700">Entrega: {ultimoRss.data_entrega || 'data não informada'}</span>
                    {diasUltimoRss !== null && diasUltimoRss > 7 && <span className="rounded-md bg-amber-100 text-amber-900 px-2 py-1 font-semibold">Há {diasUltimoRss} dias sem novo RSS até esta aula</span>}
                    {diasUltimoRss !== null && diasUltimoRss < 0 && <span className="text-slate-600">Este RSS foi entregue depois da data da aula selecionada.</span>}
                    {resumoAluno.totalRegistrosEntregues < resumoAluno.totalRegistrosEsperados && <span className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1">{resumoAluno.totalRegistrosEsperados - resumoAluno.totalRegistrosEntregues} semana(s) a conferir</span>}
                  </div>
                  <LeituraRss registros={[ultimoRss]} />
                </> : <p className="text-xs text-slate-600">Nenhum texto ou entrega de RSS localizados para esta matrícula ou grupo na base consultada. Isso não comprova ausência de entrega.</p>}
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2" aria-label="Orientação da aula anterior">
                <h4 className="font-bold text-sm text-slate-900">Retomar orientação anterior</h4>
                {orientacoesAnteriores.length ? <div className="space-y-1 text-xs text-slate-700">
                  <p className="font-semibold">{orientacoesAnteriores[0].data_hora.slice(0,10)} · {orientacoesAnteriores[0].categoria} · {orientacoesAnteriores[0].status}</p>
                  <p className="whitespace-pre-wrap break-words">{orientacoesAnteriores[0].texto}</p>
                </div> : <p className="text-xs text-slate-600">Nenhuma orientação anterior à data selecionada localizada.</p>}
                {registrosAulaAnterior.length > 0 && <details className="text-xs text-slate-700"><summary className="cursor-pointer font-semibold">Último registro da supervisão anterior</summary><p className="mt-2 whitespace-pre-wrap break-words">{registrosAulaAnterior[0].texto}</p></details>}
                <button type="button" onClick={() => setModalType('orientacao')} className="min-h-10 rounded-lg bg-slate-900 px-3 text-white text-xs font-semibold">+ Registrar orientação</button>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3" aria-label="Participação e contribuição na aula">
                <div><h4 className="font-bold text-sm text-slate-900">Participação e contribuições nesta aula</h4><p className="text-xs text-slate-600">Registro formativo da data {hojeIso}. Não atribui nota nem presença automaticamente.</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([['Participou da discussão',participacao,setParticipacao],['Apresentou leitura dirigida',leituraDirigida,setLeituraDirigida],['Compartilhou caso para supervisão',casoCompartilhado,setCasoCompartilhado]] as const).map(([rotulo,valor,mudar]) =>
                    <label key={rotulo} className="text-xs font-semibold text-slate-700">{rotulo}<select value={valor} onChange={e => {mudar(e.target.value);setFormularioAlterado(true);}} className="block mt-1 w-full min-h-10 bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900">
                      <option value="NAO_REGISTRADO">A registrar</option><option value="SIM">Sim</option><option value="NAO">Não</option><option value="NAO_SE_APLICA">Não se aplica</option>
                    </select></label>
                  )}
                </div>
                <label className="block text-xs font-semibold text-slate-700">Observação formativa opcional (sem identificar pacientes)
                  <textarea value={observacaoFormativa} onChange={e => {setObservacaoFormativa(e.target.value);setFormularioAlterado(true);}} rows={2} maxLength={1500} className="block mt-1 w-full border border-slate-200 p-2 bg-white rounded-lg text-sm text-slate-900" />
                </label>
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="text-xs text-slate-600">{registrosSupervisao.filter(r => r.matricula_id === selectedMatriculaId && r.data_hora?.slice(0,10) === hojeIso && r.categoria === 'PARTICIPACAO_AULA').length} registro(s) formativo(s) nesta data</span>
                  <button type="button" onClick={() => void registrarParticipacao()} disabled={registrandoParticipacao || (registroFormativoAnterior ? !formularioAlterado : (participacao === 'NAO_REGISTRADO' && leituraDirigida === 'NAO_REGISTRADO' && casoCompartilhado === 'NAO_REGISTRADO' && !observacaoFormativa.trim()))}
                    className="min-h-11 rounded-lg bg-teal-800 disabled:opacity-40 text-white px-4 text-xs font-semibold">{registrandoParticipacao ? 'Salvando…' : registroFormativoAnterior ? 'Atualizar registro formativo' : 'Salvar registro formativo'}</button>
                </div>
                {erroParticipacao && <p role="status" className="text-xs text-slate-700">{erroParticipacao}</p>}
                {registrosSupervisao.filter(r => r.matricula_id === selectedMatriculaId && r.data_hora?.slice(0,10) === hojeIso && r.categoria === 'PARTICIPACAO_AULA').length > 0 &&
                  <details className="text-xs text-slate-600"><summary className="font-semibold cursor-pointer">Ver registros anteriores desta aula</summary>
                    {registrosSupervisao.filter(r => r.matricula_id === selectedMatriculaId && r.data_hora?.slice(0,10) === hojeIso && r.categoria === 'PARTICIPACAO_AULA').map(r => <p key={r.registro_id} className="whitespace-pre-wrap mt-2 p-2 border rounded-lg text-slate-700">{r.texto}</p>)}
                  </details>}
              </section>
              {/* RESUMO COMPACTO DE INDICADORES */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <div className="text-[11px] text-slate-500">Registros Semanais (RSS)</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {resumoAluno.totalRegistrosEntregues}
                    <span className="text-slate-400 font-normal"> de </span>
                    {resumoAluno.totalRegistrosEsperados}
                    <span className="text-[11px] text-slate-400 font-normal"> esperados</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
                    <span className="text-emerald-600 font-semibold">
                      {resumoAluno.totalRegistrosEntregues >= resumoAluno.totalRegistrosEsperados ? 'Em dia' : 'Atrasado'}
                    </span>
                    <span>{resumoAluno.totalPrevistoNoPeriodo ?? 12} no semestre</span>
                  </div>
                </div>

                <div
                  className={`p-3 bg-white border rounded-xl shadow-xs ${
                    resumoAluno.faltasInjustificadasCount > 0
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-500">Faltas no Semestre</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {resumoAluno.faltasInjustificadasCount}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {resumoAluno.faltasInjustificadasCount > 0 ? '⚠ Injustificada' : 'Sem faltas graves'}
                  </div>
                </div>

                <div
                  className={`p-3 bg-white border rounded-xl shadow-xs ${
                    resumoAluno.docsPendentesCount > 0
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-500">Documentação</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {resumoAluno.docsPendentesCount === 0
                      ? 'Regular'
                      : `${resumoAluno.docsPendentesCount} pend.`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {resumoAluno.docsPendentesCount > 0 ? 'TCLE / Termo' : 'Tudo entregue'}
                  </div>
                </div>

                <div
                  className={`p-3 bg-white border rounded-xl shadow-xs ${
                    resumoAluno.orientacoesAbertasCount > 0
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-500">Orientações Abertas</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {resumoAluno.orientacoesAbertasCount}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {resumoAluno.orientacoesAbertasCount > 0 ? 'Aguardando retorno' : 'Resolvidas'}
                  </div>
                </div>
              </div>

              {/* PONTOS FORMATIVOS ATIVOS */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-900">
                      Pontos de Acompanhamento Formativo
                    </span>
                  </div>
                  <button
                    onClick={() => setModalType('ponto')}
                    className="text-xs text-slate-700 hover:text-slate-950 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Ponto</span>
                  </button>
                </div>

                {resumoAluno.pontosAtivos.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    Nenhum ponto formativo em aberto para este estudante.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resumoAluno.pontosAtivos.map(ponto => (
                      <div
                        key={ponto.ponto_id}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => togglePontoStatus(ponto.ponto_id)}
                            className="mt-0.5 w-4 h-4 rounded border border-slate-300 hover:border-slate-500 bg-white flex items-center justify-center cursor-pointer"
                            title="Concluir ponto formativo"
                          >
                            {ponto.status === 'CONCLUIDO' && (
                              <Check className="w-3 h-3 text-emerald-600" />
                            )}
                          </button>
                          <div>
                            <span className="text-slate-800 font-medium leading-relaxed">
                              {ponto.texto}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Criado em {ponto.data_criacao}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => togglePontoStatus(ponto.ponto_id)}
                          className="text-[11px] text-slate-600 hover:text-emerald-700 font-medium cursor-pointer"
                        >
                          Concluir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ÚLTIMAS ORIENTAÇÕES CLÍNICAS */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Últimas Orientações da Supervisão
                  </span>
                  <button
                    onClick={() => setModalType('orientacao')}
                    className="text-xs text-slate-700 hover:text-slate-950 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Orientação</span>
                  </button>
                </div>

                {resumoAluno.ultimasOrientacoes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    Nenhuma orientação registrada para este estudante ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resumoAluno.ultimasOrientacoes.map(ori => {
                      const isAberta = ori.status === 'ABERTA';
                      return (
                        <div
                          key={ori.orientacao_id}
                          className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{ori.categoria}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  isAberta
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isAberta ? 'Aberta' : 'Concluída'}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed">{ori.texto}</p>
                          </div>
                          <button
                            onClick={() => toggleOrientacaoStatus(ori.orientacao_id)}
                            className="text-[11px] text-slate-500 hover:text-slate-900 font-medium underline cursor-pointer"
                          >
                            {isAberta ? 'Concluir' : 'Reabrir'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AÇÕES RÁPIDAS FORMATIVAS EM SALA */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                  Ações Rápidas Durante o Atendimento
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    onClick={() => setModalType('orientacao')}
                    className="p-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Orientação</span>
                  </button>

                  <button
                    onClick={() => setModalType('feedback')}
                    className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-600" />
                    <span>+ Feedback</span>
                  </button>

                  <button
                    onClick={() => setModalType('ponto')}
                    className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-600" />
                    <span>+ Ponto Formativo</span>
                  </button>

                  <button
                    onClick={() => setModalType('ocorrencia')}
                    className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Ocorrência</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: MARCAR AULA COMO NÃO REALIZADA */}
      {modalType === 'naoRealizada' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Marcar Aula como Não Realizada
                </h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Esta ação registra que o encontro da turma <strong>{turma?.nome}</strong> em{' '}
              <strong>{hojeIso}</strong> não aconteceu. <strong>NÃO</strong> gerará falta para os
              estudantes nem chamada pendente.
            </p>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Motivo do Encontro Não Ocorrido</label>
                <select
                  value={motivoNaoRealizada}
                  onChange={e => setMotivoNaoRealizada(e.target.value as MotivoNaoRealizado)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-xs font-semibold text-slate-800"
                >
                  <option value="Feriado">Feriado</option>
                  <option value="Recesso acadêmico">Recesso acadêmico</option>
                  <option value="Cancelamento institucional">Cancelamento institucional</option>
                  <option value="Cancelamento da professora">Cancelamento da professora</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Observação (Opcional)</label>
                <input
                  type="text"
                  value={obsNaoRealizada}
                  onChange={e => setObsNaoRealizada(e.target.value)}
                  placeholder="Ex: Feriado da Proclamação da República"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await marcarEncontroNaoRealizado(
                    turmaId,
                    hojeIso,
                    motivoNaoRealizada,
                    obsNaoRealizada
                  );
                  setModalType(null);
                  onEncerrar();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer"
              >
                Confirmar Aula Não Realizada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REAGENDAR AULA */}
      {modalType === 'reagendar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Reagendar Supervisão</h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              A data original ({hojeIso}) será preservada no histórico e não gerará faltas nem chamada
              pendente. A nova data assumirá o encontro ativo.
            </p>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nova Data do Encontro</label>
                <input
                  type="date"
                  required
                  value={novaDataReagendada}
                  onChange={e => setNovaDataReagendada(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 bg-slate-50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Novo Horário (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: 08:30–11:00 (deixar em branco para manter)"
                  value={novoHorarioReagendado}
                  onChange={e => setNovoHorarioReagendado(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Motivo do Reagendamento</label>
                <input
                  type="text"
                  placeholder="Ex: Reposição de feriado acadêmico"
                  value={motivoReagendamento}
                  onChange={e => setMotivoReagendamento(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={transferirEstudoCheck}
                  onChange={e => setTransferirEstudoCheck(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Transferir estudo dirigido e leitores previstos para a nova data</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (novaDataReagendada) {
                    await reagendarEncontro(
                      turmaId,
                      hojeIso,
                      novaDataReagendada,
                      novoHorarioReagendado,
                      motivoReagendamento,
                      transferirEstudoCheck
                    );
                    setModalType(null);
                  }
                }}
                disabled={!novaDataReagendada}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-bold cursor-pointer"
              >
                Confirmar Reagendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MAIS EXCEÇÃO (+ Observação / Justificativa na Chamada) */}
      {modalType === 'maisExcecao' && matriculaParaMais && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Anotações de Chamada —{' '}
                {alunosLista.find(a => a.matricula.matricula_id === matriculaParaMais)?.aluno.nome}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Justificativa de Falta (se houver atestado ou comunicação prévia)
                </label>
                <textarea
                  rows={2}
                  value={excecoes[matriculaParaMais]?.justificativa || ''}
                  onChange={e =>
                    setExcecoes(prev => ({
                      ...prev,
                      [matriculaParaMais]: {
                        ...(prev[matriculaParaMais] || { faltou: true, atraso: false, celular: false }),
                        justificativa: e.target.value,
                      },
                    }))
                  }
                  placeholder="Ex: Atestado médico de 24h enviado por e-mail..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Observação Pontual da Chamada
                </label>
                <input
                  type="text"
                  value={excecoes[matriculaParaMais]?.observacao || ''}
                  onChange={e =>
                    setExcecoes(prev => ({
                      ...prev,
                      [matriculaParaMais]: {
                        ...(prev[matriculaParaMais] || { faltou: false, atraso: false, celular: false }),
                        observacao: e.target.value,
                      },
                    }))
                  }
                  placeholder="Ex: Saiu 20min mais cedo para atendimento externo..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
              >
                Pronto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS DA FICHA: ORIENTAÇÃO, FEEDBACK, PONTO */}
      {modalType === 'orientacao' && (
        <ModalNovaOrientacao
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          dataAula={hojeIso}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'feedback' && (
        <ModalNovoFeedback
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'ponto' && (
        <ModalNovoPontoAcompanhamento
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'ocorrencia' && (
        <ModalRegistrarOcorrencia
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          tipoInicial="USO_INADEQUADO_DISPOSITIVO"
          onClose={() => setModalType(null)}
        />
      )}
    </div>
  );
};
