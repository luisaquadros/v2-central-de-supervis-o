import React from 'react';
import {
  AlertCircle, ArrowRight, BookOpen, CalendarDays, CheckCircle2, ClipboardList,
  Clock3, FileCheck2, GraduationCap, ListChecks, MessageSquareText, Play,
  RefreshCw, UsersRound, UserCheck,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { resumirDocumentacaoOficial } from '../services/documentacaoAcademicaService';
import { getHojeDataIso, listarProximasSupervisoes } from '../services/supervisaoOperacionalService';
import { selecionarTresProximasAulas, resumirPendenciasPorTema } from '../services/painelInicialService';
import type { NavTab } from '../types';

interface HojeViewProps {
  onOpenTurma: (turmaId: string) => void;
  onIniciarSupervisao: (turmaId: string) => void;
  onNavigateToTab: (tab: NavTab, param?: string) => void;
  onOpenPrepararAula?: (turmaId: string) => void;
}

const formatoData = (iso: string): string => {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return ano && mes && dia ? [dia, mes, ano].join('/') : 'Data não informada';
};

const CARD = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-xs';
const BOTAO_LINK = 'inline-flex items-center gap-1 text-xs font-bold text-teal-800 hover:text-teal-950 hover:underline focus-visible:outline-2 focus-visible:outline-teal-600';

export const HojeView: React.FC<HojeViewProps> = ({
  onOpenTurma, onIniciarSupervisao, onNavigateToTab, onOpenPrepararAula,
}) => {
  const {
    periodos, selectedPeriodoId, turmas, matriculas, entregas, documentos,
    orientacoes, avaliacoesCompletas, horariosTurma, encontrosTurma,
    marcosAcademicos, getPendenciasCanonicas, getChamadasPendentes,
    sincronizarAgora, saveStatus, connectionStatus,
  } = useSupervisao();

  const [agora, setAgora] = React.useState(() => new Date());
  const [atualizando, setAtualizando] = React.useState(false);
  const [erroAtualizacao, setErroAtualizacao] = React.useState('');
  React.useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hojeIso = getHojeDataIso(agora);
  const periodo = periodos.find(p => p.periodo_id === selectedPeriodoId);
  const turmasAtivas = turmas.filter(t => t.status === 'ATIVO' && (!selectedPeriodoId || t.periodo_id === selectedPeriodoId));
  const idsTurmas = new Set(turmasAtivas.map(t => t.turma_id));
  const matriculasAtivas = matriculas.filter(m =>
    m.status === 'MATRICULADO' && idsTurmas.has(m.turma_id) && (!selectedPeriodoId || m.periodo_id === selectedPeriodoId));
  const idsMatriculas = new Set(matriculasAtivas.map(m => m.matricula_id));
  const estudantesDistintos = new Set(matriculasAtivas.map(m => m.aluno_id)).size;
  const pendencias = getPendenciasCanonicas();
  const chamadas = getChamadasPendentes();
  const porTema = resumirPendenciasPorTema(pendencias).slice(0, 5);
  const documentosResumo = resumirDocumentacaoOficial(entregas, documentos, idsMatriculas);
  const orientacoesAbertas = orientacoes.filter(o => o.status === 'ABERTA' && idsMatriculas.has(o.matricula_id)).length;
  const rssRecentesPendentes = pendencias.filter(p => p.tipo === 'RSS_ATRASADO').length;
  const avaliados = new Set(avaliacoesCompletas.filter(a =>
    idsMatriculas.has(a.matricula_id) && ['AVALIADA','APROVADO_ENVIO','ENVIADO'].includes(a.status))
    .map(a => a.matricula_id)).size;

  const agenda = listarProximasSupervisoes(turmasAtivas, horariosTurma, encontrosTurma, agora, 45);
  const proximasAulas = selecionarTresProximasAulas(agenda);
  const proximosPrazos = marcosAcademicos.filter(m =>
    (!selectedPeriodoId || m.periodo_id === selectedPeriodoId) &&
    (!m.turma_id || idsTurmas.has(m.turma_id)) &&
    m.data_prazo && m.data_prazo.slice(0, 10) >= hojeIso && m.status !== 'CONCLUIDO'
  ).sort((a, b) => a.data_prazo.localeCompare(b.data_prazo)).slice(0, 3);

  const indicadores = [
    {titulo:'Turmas ativas', valor:turmasAtivas.length.toString(), detalhe:'Acompanhamento do semestre', Icon:GraduationCap, destino:'turmas' as NavTab},
    {titulo:'Estudantes', valor:estudantesDistintos.toString(), detalhe:'Pessoas únicas nas turmas', Icon:UsersRound, destino:'alunos' as NavTab},
    {titulo:'Pendências abertas', valor:pendencias.length.toString(), detalhe:'Acompanhar por turma e assunto', Icon:ClipboardList, destino:'pendencias' as NavTab},
    {titulo:'Documentação', valor:documentosResumo.total ? String(documentosResumo.pendentes + documentosResumo.conferir) : '—',
      detalhe:documentosResumo.total ? String(documentosResumo.pendentes) + ' pendente(s) · ' + String(documentosResumo.conferir) + ' a conferir' : 'Aguardando dados da base',
      Icon:FileCheck2, destino:'pendencias' as NavTab},
    {titulo:'Chamadas atrasadas', valor:chamadas.length.toString(), detalhe:'Encontros para regularizar', Icon:UserCheck, destino:'frequencia' as NavTab},
    {titulo:'Orientações em aberto', valor:orientacoesAbertas.toString(), detalhe:'Retomar nos próximos encontros', Icon:MessageSquareText, destino:'pendencias' as NavTab},
  ];

  const atualizar = async () => {
    if (atualizando) return;
    setAtualizando(true);
    setErroAtualizacao('');
    try { await sincronizarAgora(); setAgora(new Date()); }
    catch (err) { setErroAtualizacao(err instanceof Error ? err.message : 'Falha ao atualizar. Verifique a sincronização.'); }
    finally { setAtualizando(false); }
  };

  return <main className="mx-auto max-w-7xl space-y-5 pb-10" aria-label="Início: visão geral da supervisão">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Painel da professora</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900">Visão geral</h1>
        <p className="mt-1 text-sm text-slate-600">
          {periodo?.nome || 'Semestre selecionado'} · {new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(agora)}
        </p>
      </div>
      <button type="button" disabled={atualizando} onClick={() => void atualizar()}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 flex gap-2 items-center disabled:opacity-50 hover:bg-slate-50">
        <RefreshCw className="w-4 h-4" aria-hidden="true" /> {atualizando ? 'Atualizando…' : 'Atualizar dados'}
      </button>
    </header>

    {erroAtualizacao && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{erroAtualizacao}</p>}
    {connectionStatus !== 'CONECTADO' && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <AlertCircle className="mr-1 inline h-4 w-4" aria-hidden="true" />
      Conexão com a base não confirmada; os números podem refletir o último cache salvo.
    </p>}

    {/* Indicadores: sempre contagens do semestre selecionado, sem somar matrícula duplicada como pessoa. */}
    <section aria-label="Indicadores principais">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">O essencial, em um olhar</h2>
        <span className="text-xs text-slate-500">Selecione um bloco para abrir os detalhes</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {indicadores.map(d => <button type="button" key={d.titulo}
          onClick={() => onNavigateToTab(d.destino)}
          className="rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xs transition-colors hover:border-teal-400 hover:bg-teal-50/30 focus-visible:outline-2 focus-visible:outline-teal-700">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[11px] font-semibold leading-4">{d.titulo}</span>
            <d.Icon className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true"/>
          </div>
          <div className="mt-3 text-2xl font-black tabular-nums text-slate-900">{d.valor}</div>
          <p className="mt-1 min-h-8 text-[11px] leading-4 text-slate-600">{d.detalhe}</p>
        </button>)}
      </div>
    </section>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <section className={CARD + ' space-y-3 xl:col-span-3'} aria-label="Três próximas aulas">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">Próximas 3 aulas</h2>
          </div>
          <button type="button" onClick={() => onNavigateToTab('calendario')} className={BOTAO_LINK}>
            Calendário completo <ArrowRight className="h-3.5 w-3.5" aria-hidden="true"/>
          </button>
        </div>
        {proximasAulas.length===0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          Nenhuma aula futura encontrada nos próximos 45 dias. Confira o calendário oficial e os horários cadastrados.
        </p> : <ol className="divide-y divide-slate-100">
          {proximasAulas.map((aula,index)=>{
            const hoje = aula.dataProxima===hojeIso;
            const data = formatoData(aula.dataProxima);
            return <li key={aula.turma.turma_id+'-'+aula.dataProxima+'-'+aula.horaInicio}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                  <strong className="text-sm">{data.slice(0,2)}</strong>
                  <span className="text-[10px] uppercase">{new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(aula.dataProxima+'T12:00:00'))}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{aula.turma.nome}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-600">
                    {aula.diaSemanaNome} · {aula.horaInicio}–{aula.horaFim}
                    {hoje && <span className="ml-1 rounded bg-teal-50 px-1.5 py-0.5 font-bold text-teal-800">Hoje</span>}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 pl-14 sm:pl-0">
                <button type="button" onClick={() => onOpenTurma(aula.turma.turma_id)}
                  className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Turma</button>
                {hoje ? <button type="button" onClick={() => onIniciarSupervisao(aula.turma.turma_id)}
                  className="flex min-h-10 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800">
                  <Play className="h-3.5 w-3.5" aria-hidden="true"/> Modo Aula</button> :
                  <button type="button" onClick={() => onOpenPrepararAula ? onOpenPrepararAula(aula.turma.turma_id) : onOpenTurma(aula.turma.turma_id)}
                    className="min-h-10 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800">Preparar</button>}
              </div>
            </li>;
          })}
        </ol>}
        <p className="text-[11px] text-slate-500">Aulas em ordem cronológica, considerando cancelamentos e reagendamentos cadastrados.</p>
      </section>

      <section className={CARD + ' space-y-3 xl:col-span-2'} aria-label="Resumo das pendências">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-amber-700" aria-hidden="true"/>
            <h2 className="text-base font-bold text-slate-900">Precisa da sua atenção</h2>
          </div>
          <button onClick={()=>onNavigateToTab('pendencias')} className={BOTAO_LINK}>Ver pendências <ArrowRight className="h-3.5 w-3.5" aria-hidden="true"/></button>
        </div>
        {porTema.length===0 ? <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true"/> Nenhuma pendência acionável encontrada na base selecionada.
        </div> : <div className="space-y-2">
          {porTema.map(tema=><button type="button" key={tema.chave} onClick={()=>onNavigateToTab('pendencias')}
            className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-teal-300">
            <div>
              <p className="text-xs font-bold text-slate-900">{tema.titulo}</p>
              <p className="text-[11px] text-slate-500">{tema.descricao}</p>
            </div>
            <span className="ml-2 rounded-lg bg-white px-2.5 py-1 text-sm font-black tabular-nums text-amber-900">{tema.quantidade}</span>
          </button>)}
        </div>}
        <p className="text-[11px] text-slate-500">Cobranças enviadas não são consideradas documentos entregues.</p>
      </section>
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className={CARD + ' space-y-3'} aria-label="Próximos prazos acadêmicos">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Clock3 className="h-4 w-4 text-teal-700" aria-hidden="true"/> Próximos prazos
          </h2>
          <button onClick={()=>onNavigateToTab('calendario')} className={BOTAO_LINK}>Ver calendário <ArrowRight className="h-3.5 w-3.5" aria-hidden="true"/></button>
        </div>
        {!proximosPrazos.length ? <p className="text-sm text-slate-600">Sem prazos futuros cadastrados neste período.</p> :
          <ul className="divide-y divide-slate-100">{proximosPrazos.map(p=><li key={p.marco_id} className="flex gap-3 py-2">
            <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold tabular-nums text-slate-800">{formatoData(p.data_prazo)}</span>
            <span className="text-xs font-semibold text-slate-800">{p.nome}</span>
          </li>)}</ul>}
      </section>

      <section className={CARD + ' space-y-3'} aria-label="Acompanhamento formativo">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <BookOpen className="h-4 w-4 text-teal-700" aria-hidden="true"/> Acompanhamento acadêmico
          </h2>
          <button onClick={()=>onNavigateToTab('avaliacao')} className={BOTAO_LINK}>Avaliações <ArrowRight className="h-3.5 w-3.5" aria-hidden="true"/></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={()=>onNavigateToTab('turmas')} className="rounded-xl bg-slate-50 p-3 text-left hover:bg-teal-50">
            <p className="text-[11px] font-semibold text-slate-600">RSS recentes em atraso</p>
            <strong className="mt-2 block text-xl tabular-nums text-slate-900">{rssRecentesPendentes}</strong>
            <p className="text-[11px] text-slate-500">Ver detalhes nas turmas</p>
          </button>
          <button type="button" onClick={()=>onNavigateToTab('avaliacao')} className="rounded-xl bg-slate-50 p-3 text-left hover:bg-teal-50">
            <p className="text-[11px] font-semibold text-slate-600">Matrículas com avaliação concluída</p>
            <strong className="mt-2 block text-xl tabular-nums text-slate-900">{avaliados} <span className="text-xs text-slate-500">/ {matriculasAtivas.length}</span></strong>
            <p className="text-[11px] text-slate-500">Ao menos uma avaliação concluída</p>
          </button>
        </div>
      </section>
    </div>
    <p className="text-[11px] text-slate-500">Os indicadores representam registros da base oficial e não substituem a conferência dos documentos, RSS ou frequência individual.</p>
  </main>;
};
