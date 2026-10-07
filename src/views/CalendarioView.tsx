import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, BookOpen, Layers, Award, AlertCircle, Users, CheckCircle, ArrowRight, Filter, Info, AlertTriangle, Plus, RotateCcw, X, Check } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { CalendarioRss, MotivoNaoRealizado } from '../types';
import {
  calcularMetricasCronogramaRss,
  obterDatasCalendarioAcademico,
} from '../services/supervisaoOperacionalService';

export const CalendarioView: React.FC = () => {
  const {
    horariosTurma,
    turmas,
    calendarioRss,
    situacaoAtualTurmas,
    leiturasResponsaveis,
    marcosAcademicos,
    selectedPeriodoId,
    periodos,
    encontrosTurma,
    marcarEncontroNaoRealizado,
    reagendarEncontro,
    reverterNaoRealizadoOuReagendado,
  } = useSupervisao();

  const [relogioAtivo, setRelogioAtivo] = useState<'PRATICA_RSS' | 'AULAS' | 'LEITURAS' | 'MARCOS'>('PRATICA_RSS');
  const [modoVisualizacao, setModoVisualizacao] = useState<'SEQUENCIA' | 'TURMA' | 'TODOS'>('SEQUENCIA');
  const [selectedTurmaFiltro, setSelectedTurmaFiltro] = useState<string>('TODAS');

  // Modal de Exceção Operacional (Aula Não Realizada / Reagendamento)
  const [modalExcecao, setModalExcecao] = useState<'naoRealizada' | 'reagendar' | null>(null);
  const [modalTurmaId, setModalTurmaId] = useState<string>('');
  const [modalData, setModalData] = useState<string>('');
  const [modalMotivoNaoRealizada, setModalMotivoNaoRealizada] = useState<MotivoNaoRealizado>('Feriado');
  const [modalObs, setModalObs] = useState<string>('');
  const [modalNovaData, setModalNovaData] = useState<string>('');
  const [modalNovoHorario, setModalNovoHorario] = useState<string>('');
  const [modalTransferirEstudo, setModalTransferirEstudo] = useState<boolean>(true);

  const diasSemanaNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  // Data de referência (hoje)
  const hojeStr = new Date().toISOString().split('T')[0];

  // Helper para formatar data ISO YYYY-MM-DD em DD/MM/YYYY
  const formatarData = (dataStr?: string) => {
    if (!dataStr) return 'A definir';
    const parts = dataStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dataStr;
  };

  // Cálculo das semanas únicas por sequência a partir dos dados reais da tabela calendario_rss
  // (72 registros = 6 turmas × 12 semanas por turma)
  const cronogramaSemanalConsolidado = useMemo(() => {
    if (calendarioRss.length === 0) return [];

    const mapSequencia = new Map<number, {
      sequencia: number;
      semana_inicio: string;
      semana_fim: string;
      status_calendario: string;
      obrigatorio_sem_atendimento: boolean;
      registros: CalendarioRss[];
    }>();

    calendarioRss.forEach(item => {
      const seq = Number(item.sequencia || item.semana || 0);
      if (seq <= 0) return;

      const inicio = item.semana_inicio || item.data_prevista || '';
      const fim = item.semana_fim || item.data_limite || '';

      // Determina status de forma resiliente
      let status = item.status_calendario || '';
      if (!status) {
        if (fim && fim < hojeStr) status = 'CONCLUIDA';
        else if (inicio && fim && hojeStr >= inicio && hojeStr <= fim) status = 'ATUAL';
        else status = 'FUTURA';
      }

      if (!mapSequencia.has(seq)) {
        mapSequencia.set(seq, {
          sequencia: seq,
          semana_inicio: inicio,
          semana_fim: fim,
          status_calendario: status,
          obrigatorio_sem_atendimento: item.obrigatorio_sem_atendimento === true || String(item.obrigatorio_sem_atendimento).toUpperCase() === 'TRUE',
          registros: [item],
        });
      } else {
        const existing = mapSequencia.get(seq)!;
        existing.registros.push(item);
        if (!existing.semana_inicio && inicio) existing.semana_inicio = inicio;
        if (!existing.semana_fim && fim) existing.semana_fim = fim;
        if (status === 'ATUAL') existing.status_calendario = 'ATUAL';
      }
    });

    return Array.from(mapSequencia.values()).sort((a, b) => a.sequencia - b.sequencia);
  }, [calendarioRss, hojeStr]);

  // Cálculos canônicos da base oficial com garantia de invariante acadêmica
  const metricasTurmaSelecionada = useMemo(() => {
    if (selectedTurmaFiltro === 'TODAS') return null;
    return calcularMetricasCronogramaRss(selectedTurmaFiltro, calendarioRss, situacaoAtualTurmas, hojeStr);
  }, [selectedTurmaFiltro, calendarioRss, situacaoAtualTurmas, hojeStr]);

  const totalSemanasPorTurma = metricasTurmaSelecionada?.totalSemanas || (cronogramaSemanalConsolidado.length > 0 ? cronogramaSemanalConsolidado.length : 12);
  const semanasEncerradas = metricasTurmaSelecionada?.semanasEncerradas !== null && metricasTurmaSelecionada?.semanasEncerradas !== undefined
    ? metricasTurmaSelecionada.semanasEncerradas
    : cronogramaSemanalConsolidado.filter(
        s => s.status_calendario === 'CONCLUIDA' || (s.semana_fim && s.semana_fim < hojeStr)
      ).length;

  const itemSemanaAtual = cronogramaSemanalConsolidado.find(
    s => s.status_calendario === 'ATUAL' || (s.semana_inicio && s.semana_fim && hojeStr >= s.semana_inicio && hojeStr <= s.semana_fim)
  );

  const semanaAtualNumero = metricasTurmaSelecionada?.semanaAtual !== null && metricasTurmaSelecionada?.semanaAtual !== undefined
    ? metricasTurmaSelecionada.semanaAtual
    : (itemSemanaAtual ? itemSemanaAtual.sequencia : (semanasEncerradas + 1 <= totalSemanasPorTurma ? semanasEncerradas + 1 : totalSemanasPorTurma));

  const semanaAtualTexto = metricasTurmaSelecionada
    ? metricasTurmaSelecionada.semanaTexto
    : (semanaAtualNumero ? `${semanaAtualNumero} / ${totalSemanasPorTurma}` : '—');

  const semanasEncerradasTexto = metricasTurmaSelecionada
    ? metricasTurmaSelecionada.semanasEncerradasTexto
    : `${semanasEncerradas}`;

  // Filtro por turma (estrito por turma_id)
  const registrosFiltradosPorTurma = useMemo(() => {
    if (selectedTurmaFiltro === 'TODAS') {
      return calendarioRss;
    }
    return calendarioRss.filter(c => c.turma_id === selectedTurmaFiltro);
  }, [calendarioRss, selectedTurmaFiltro]);

  const currentPeriodo = periodos.find(p => p.periodo_id === selectedPeriodoId) || periodos[0];
  const infoAcademica = useMemo(() => obterDatasCalendarioAcademico(currentPeriodo), [currentPeriodo]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Calendário Integrado da Supervisão
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Três Relógios Acadêmicos Independentes
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Separação rigorosa entre horários de supervisão presencial, cronograma semanal de prática/RSS e leituras teóricas
        </p>
      </div>

      {/* SEPARAÇÃO EXPLÍCITA: CALENDÁRIO ACADÊMICO OFICIAL vs CRONOGRAMA DE PRÁTICA */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/60 to-white border border-blue-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200">
                Calendário Acadêmico Oficial
              </span>
              <span className="text-xs text-slate-500 font-semibold">Semestre {infoAcademica.nome}</span>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Vigência letiva oficial: <strong>{formatarData(infoAcademica.dataInicio)}</strong> a <strong>{formatarData(infoAcademica.dataFim)}</strong> (Semana de 01/12/2026).
            </p>
            <p className="text-[11px] text-slate-500">
              O Calendário Acadêmico possui autoridade máxima sobre início e término do semestre letivo. O cronograma de prática (1 a 12 semanas) organiza a operação clínica e RSS, sem antecipar o encerramento acadêmico.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/90 p-3 rounded-xl border border-blue-100 text-xs shrink-0">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Início Acadêmico</span>
              <strong className="text-sm text-slate-800 font-mono">{formatarData(infoAcademica.dataInicio)}</strong>
            </div>
            <div className="w-px h-7 bg-slate-200" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Término Oficial</span>
              <strong className="text-sm text-blue-700 font-mono">{formatarData(infoAcademica.dataFim)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Relógios Switch Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setRelogioAtivo('PRATICA_RSS')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            relogioAtivo === 'PRATICA_RSS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase">1. Prática + RSS</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-sm font-black">Cronograma Semanal</span>
          <span className={`text-[11px] mt-1 ${relogioAtivo === 'PRATICA_RSS' ? 'text-slate-300' : 'text-slate-400'}`}>
            {totalSemanasPorTurma} semanas por turma ({calendarioRss.length} registros)
          </span>
        </button>

        <button
          onClick={() => setRelogioAtivo('AULAS')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            relogioAtivo === 'AULAS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase">2. Supervisão / Aulas</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-sm font-black">Dias & Horários</span>
          <span className={`text-[11px] mt-1 ${relogioAtivo === 'AULAS' ? 'text-slate-300' : 'text-slate-400'}`}>
            horarios_turma (encontros presenciais)
          </span>
        </button>

        <button
          onClick={() => setRelogioAtivo('LEITURAS')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            relogioAtivo === 'LEITURAS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase">3. Leituras & Textos</span>
            <BookOpen className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-sm font-black">Seminários & Temas</span>
          <span className={`text-[11px] mt-1 ${relogioAtivo === 'LEITURAS' ? 'text-slate-300' : 'text-slate-400'}`}>
            leituras_responsaveis
          </span>
        </button>

        <button
          onClick={() => setRelogioAtivo('MARCOS')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            relogioAtivo === 'MARCOS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase">4. Marcos Acadêmicos</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-sm font-black">Prazos & Provas</span>
          <span className={`text-[11px] mt-1 ${relogioAtivo === 'MARCOS' ? 'text-slate-300' : 'text-slate-400'}`}>
            marcos_academicos
          </span>
        </button>
      </div>

      {/* Relógio 1: Prática + RSS */}
      {relogioAtivo === 'PRATICA_RSS' && (
        <div className="space-y-4">
          {/* Card de Resumo das Regras Oficiais e Status Atual */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Regra RSS: 1 Obrigação por Semana
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Tabela calendario_rss</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  Cronograma de Prática & Semanas de RSS do Semestre
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cada turma possui {totalSemanasPorTurma} semanas (6 turmas × {totalSemanasPorTurma} = {calendarioRss.length} registros). Semana aberta não gera atraso. Feriados e ausência de paciente não cancelam a obrigação.
                </p>
              </div>

              {/* Status do Momento Atual */}
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Semana Atual</span>
                  <strong className="text-base text-indigo-700 font-mono">
                    {metricasTurmaSelecionada ? (metricasTurmaSelecionada.temDados ? `Semana ${metricasTurmaSelecionada.semanaAtual}` : '—') : `Semana ${semanaAtualNumero}`}
                  </strong>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Encerradas</span>
                  <strong className="text-base text-slate-800 font-mono">
                    {metricasTurmaSelecionada
                      ? (metricasTurmaSelecionada.temDados ? `${semanasEncerradasTexto} de ${totalSemanasPorTurma}` : '—')
                      : `${semanasEncerradas} de ${totalSemanasPorTurma}`}
                  </strong>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Base</span>
                  <strong className="text-base text-slate-800 font-mono">{registrosFiltradosPorTurma.length} reg.</strong>
                </div>
              </div>
            </div>

            {/* Aviso de Conflito de Base ou Ausência de Cronograma */}
            {metricasTurmaSelecionada && !metricasTurmaSelecionada.temDados && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Dados de cronograma não disponíveis para a turma selecionada.</span>
              </div>
            )}
            {metricasTurmaSelecionada?.conflitoIdentificado && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{metricasTurmaSelecionada.avisoInconsistencia}</span>
              </div>
            )}

            {/* Visual View Mode Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Visualizar:</span>
                <div className="inline-flex rounded-lg bg-slate-100 p-1">
                  <button
                    onClick={() => setModoVisualizacao('SEQUENCIA')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      modoVisualizacao === 'SEQUENCIA'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Por Sequência Semanal ({totalSemanasPorTurma} Semanas)
                  </button>
                  <button
                    onClick={() => setModoVisualizacao('TURMA')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      modoVisualizacao === 'TURMA'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Por Turma
                  </button>
                  <button
                    onClick={() => setModoVisualizacao('TODOS')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      modoVisualizacao === 'TODOS'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos os {calendarioRss.length} Registros
                  </button>
                </div>
              </div>

              {modoVisualizacao === 'TURMA' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600">Turma:</label>
                  <select
                    value={selectedTurmaFiltro}
                    onChange={e => setSelectedTurmaFiltro(e.target.value)}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value="TODAS">Todas as Turmas ({turmas.length})</option>
                    {turmas.map(t => (
                      <option key={t.turma_id} value={t.turma_id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Estado sem dados */}
          {calendarioRss.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">Sem dados do calendário</h3>
              <p className="text-xs text-slate-500">
                Aguardando sincronização da tabela <code className="font-mono">calendario_rss</code> com a planilha oficial.
              </p>
            </div>
          ) : (
            <>
              {/* MODO 1: POR SEQUÊNCIA SEMANAL DO SEMESTRE (1 A 12) */}
              {modoVisualizacao === 'SEQUENCIA' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {cronogramaSemanalConsolidado.map(semana => {
                    const isAtual = semana.status_calendario === 'ATUAL' || semana.sequencia === semanaAtualNumero;
                    const isEncerrada = semana.status_calendario === 'CONCLUIDA' || (!isAtual && semana.sequencia < semanaAtualNumero);

                    return (
                      <div
                        key={semana.sequencia}
                        className={`p-4 rounded-xl border space-y-3 transition-all ${
                          isAtual
                            ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                            : isEncerrada
                            ? 'border-slate-200 bg-slate-50/60'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-sm text-slate-900">
                            Semana {semana.sequencia}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isAtual
                                ? 'bg-indigo-600 text-white'
                                : isEncerrada
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isAtual ? 'Semana Atual (Aberta)' : isEncerrada ? 'Encerrada' : 'Futura'}
                          </span>
                        </div>

                        <div className="text-xs space-y-1 font-medium text-slate-600">
                          <div>
                            Início: <strong className="text-slate-900">{formatarData(semana.semana_inicio)}</strong>
                          </div>
                          <div>
                            Encerramento: <strong className="text-slate-900">{formatarData(semana.semana_fim)}</strong>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Aplica-se a: <strong>{semana.registros.length} turmas</strong></span>
                          {semana.obrigatorio_sem_atendimento && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="Obrigatório mesmo sem atendimento">
                              Sem atendimento: Sim
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MODO 2: POR TURMA */}
              {modoVisualizacao === 'TURMA' && (
                registrosFiltradosPorTurma.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-400 space-y-1">
                    <p className="font-bold text-slate-600 text-sm">—</p>
                    <p>Sem cronograma cadastrado para esta turma na base oficial.</p>
                  </div>
                ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="divide-y divide-slate-100">
                    {registrosFiltradosPorTurma.map((item, idx) => {
                      const seq = Number(item.sequencia || item.semana || 0);
                      const turma = turmas.find(t => t.turma_id === item.turma_id);
                      const isAtual = item.status_calendario === 'ATUAL' || seq === semanaAtualNumero;
                      const isEncerrada = item.status_calendario === 'CONCLUIDA' || (!isAtual && seq < semanaAtualNumero);

                      return (
                        <div key={item.rss_previsto_id || idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">Semana {seq}</span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {turma?.nome || item.codigo_origem || item.turma_id}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                              <span>Janela: <strong>{formatarData(item.semana_inicio || item.data_prevista)}</strong> até <strong>{formatarData(item.semana_fim || item.data_limite)}</strong></span>
                              {item.observacao && <span>• Obs: {item.observacao}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                isAtual
                                  ? 'bg-indigo-600 text-white'
                                  : isEncerrada
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isAtual ? 'Semana Atual' : isEncerrada ? 'Encerrada' : 'Futura'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )
              )}

              {/* MODO 3: TODOS OS REGISTROS */}
              {modoVisualizacao === 'TODOS' && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-bold">Total de registros materializados: {calendarioRss.length}</span>
                    <span>6 turmas × 12 semanas por turma</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                          <th className="p-3">Seq</th>
                          <th className="p-3">Turma</th>
                          <th className="p-3">Início</th>
                          <th className="p-3">Fim</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Obrig. s/ Atendimento</th>
                          <th className="p-3">Fonte</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {calendarioRss.map((item, idx) => {
                          const turma = turmas.find(t => t.turma_id === item.turma_id);
                          return (
                            <tr key={item.rss_previsto_id || idx} className="hover:bg-slate-50/70">
                              <td className="p-3 font-mono font-bold text-slate-900">
                                {item.sequencia || item.semana || '—'}
                              </td>
                              <td className="p-3 font-semibold text-slate-800">
                                {turma?.nome || item.codigo_origem || item.turma_id || '—'}
                              </td>
                              <td className="p-3 font-mono text-slate-600">
                                {formatarData(item.semana_inicio || item.data_prevista)}
                              </td>
                              <td className="p-3 font-mono text-slate-600">
                                {formatarData(item.semana_fim || item.data_limite)}
                              </td>
                              <td className="p-3">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {item.status_calendario || '—'}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600">
                                {item.obrigatorio_sem_atendimento ? 'Sim' : 'Não'}
                              </td>
                              <td className="p-3 text-slate-400 font-mono text-[10px]">
                                {item.fonte || 'calendario_rss'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Relógio 2: Supervisão / Aulas & Exceções Operacionais */}
      {relogioAtivo === 'AULAS' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Encontros Semanais de Supervisão Presencial</h2>
                <p className="text-xs text-slate-500">Dias da semana e horários fixados na tabela horarios_turma</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setModalTurmaId(turmas[0]?.turma_id || '');
                    setModalData(hojeStr);
                    setModalMotivoNaoRealizada('Feriado');
                    setModalObs('');
                    setModalExcecao('naoRealizada');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Registrar Feriado / Cancelamento</span>
                </button>

                <button
                  onClick={() => {
                    setModalTurmaId(turmas[0]?.turma_id || '');
                    setModalData(hojeStr);
                    setModalNovaData('');
                    setModalNovoHorario('');
                    setModalObs('');
                    setModalTransferirEstudo(true);
                    setModalExcecao('reagendar');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-600" />
                  <span>Reagendar Encontro</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {turmas.map(t => {
                const horario = horariosTurma.find(h => h.turma_id === t.turma_id);

                return (
                  <div key={t.turma_id} className="p-4 flex items-center justify-between gap-3 bg-white">
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">{t.nome}</span>
                      <span className="text-[11px] text-slate-500">Turno: {t.turno}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-xs text-slate-900 block font-mono">
                        {horario ? `${horario.hora_inicio} às ${horario.hora_fim}` : 'Horário da grade'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {horario ? diasSemanaNomes[horario.dia_semana] || 'Semanal' : 'Dia letivo'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seção de Exceções Operacionais (Aulas não realizadas, Feriados e Reagendamentos) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-600" />
                  <span>Histórico de Exceções e Aulas Não Realizadas</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Feriados, recessos institucionais e reagendamentos que alteram o fluxo regular de supervisão
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {encontrosTurma.length} registro(s) registrado(s)
              </span>
            </div>

            {encontrosTurma.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Nenhuma aula não realizada ou reagendamento cadastrado. Todas as supervisões seguem o cronograma regular.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {encontrosTurma.map(enc => {
                  const turma = turmas.find(t => t.turma_id === enc.turma_id);
                  const isNaoRealizada = enc.status === 'NAO_REALIZADO';
                  const isReagendada = enc.status === 'REAGENDADO';

                  return (
                    <div
                      key={enc.encontro_id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-slate-50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isNaoRealizada
                                ? 'bg-amber-100 text-amber-900'
                                : isReagendada
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {isNaoRealizada
                              ? `Não realizada: ${enc.motivo_nao_realizado || 'Cancelada'}`
                              : isReagendada
                              ? 'Reagendada'
                              : 'Realizada'}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{turma?.nome}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs font-mono text-slate-600 font-semibold">
                            Data: {formatarData(enc.data)}
                          </span>
                        </div>

                        {enc.observacao && (
                          <p className="text-xs text-slate-600 italic">
                            Obs: "{enc.observacao}"
                          </p>
                        )}

                        {isReagendada && enc.data_reagendada && (
                          <p className="text-xs text-blue-700 font-medium">
                            ↳ Nova data de realização:{' '}
                            <strong className="font-mono">{formatarData(enc.data_reagendada)}</strong>
                            {enc.hora_reagendada && ` às ${enc.hora_reagendada}`}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        <button
                          onClick={async () => {
                            if (window.confirm('Deseja reverter esta exceção e retornar a aula ao status de Prevista?')) {
                              await reverterNaoRealizadoOuReagendado(enc.turma_id, enc.data);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Reverter para prevista"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reverter</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal: Marcar Encontro Como Não Realizado */}
          {modalExcecao === 'naoRealizada' && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-sm text-slate-900">
                      Marcar Aula Como Não Realizada
                    </h3>
                  </div>
                  <button
                    onClick={() => setModalExcecao(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Turma</label>
                    <select
                      value={modalTurmaId}
                      onChange={e => setModalTurmaId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs"
                    >
                      {turmas.map(t => (
                        <option key={t.turma_id} value={t.turma_id}>
                          {t.nome} ({t.turno})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Data da Aula Não Realizada
                    </label>
                    <input
                      type="date"
                      value={modalData}
                      onChange={e => setModalData(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Motivo Oficial
                    </label>
                    <select
                      value={modalMotivoNaoRealizada}
                      onChange={e => setModalMotivoNaoRealizada(e.target.value as MotivoNaoRealizado)}
                      className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs font-semibold"
                    >
                      <option value="Feriado">Feriado</option>
                      <option value="Recesso acadêmico">Recesso acadêmico</option>
                      <option value="Cancelamento institucional">Cancelamento institucional</option>
                      <option value="Cancelamento da professora">Cancelamento da professora</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Observação (opcional)
                    </label>
                    <input
                      type="text"
                      value={modalObs}
                      onChange={e => setModalObs(e.target.value)}
                      placeholder="Ex: Feriado Nacional de Tiradentes"
                      className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">Consequências automáticas:</p>
                    <p>• NÃO gera faltas nem chamada pendente.</p>
                    <p>• NÃO gera cobrança de estudo dirigido para os estudantes.</p>
                    <p>• Exibido como informativo no Dashboard/Hoje.</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setModalExcecao(null)}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (!modalTurmaId || !modalData) return;
                      await marcarEncontroNaoRealizado(
                        modalTurmaId,
                        modalData,
                        modalMotivoNaoRealizada,
                        modalObs
                      );
                      setModalExcecao(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Reagendar Encontro */}
          {modalExcecao === 'reagendar' && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-700" />
                    <h3 className="font-bold text-sm text-slate-900">
                      Reagendar Supervisão
                    </h3>
                  </div>
                  <button
                    onClick={() => setModalExcecao(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Turma</label>
                    <select
                      value={modalTurmaId}
                      onChange={e => setModalTurmaId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs"
                    >
                      {turmas.map(t => (
                        <option key={t.turma_id} value={t.turma_id}>
                          {t.nome} ({t.turno})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Data Original
                      </label>
                      <input
                        type="date"
                        value={modalData}
                        onChange={e => setModalData(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Nova Data Válida
                      </label>
                      <input
                        type="date"
                        value={modalNovaData}
                        onChange={e => setModalNovaData(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Novo Horário (opcional)
                    </label>
                    <input
                      type="text"
                      value={modalNovoHorario}
                      onChange={e => setModalNovoHorario(e.target.value)}
                      placeholder="Ex: 14:00 - 16:40"
                      className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Motivo do Reagendamento
                    </label>
                    <input
                      type="text"
                      value={modalObs}
                      onChange={e => setModalObs(e.target.value)}
                      placeholder="Ex: Reposição de aula / Encontro extraordinário"
                      className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalTransferirEstudo}
                      onChange={e => setModalTransferirEstudo(e.target.checked)}
                      className="rounded text-slate-900"
                    />
                    <span className="text-[11px] text-slate-700">
                      Transferir estudo dirigido e responsáveis previstos para a nova data
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setModalExcecao(null)}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (!modalTurmaId || !modalData || !modalNovaData) return;
                      await reagendarEncontro(
                        modalTurmaId,
                        modalData,
                        modalNovaData,
                        modalNovoHorario,
                        modalObs,
                        modalTransferirEstudo
                      );
                      setModalExcecao(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
                  >
                    Confirmar Reagendamento
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Relógio 3: Leituras */}
      {relogioAtivo === 'LEITURAS' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Cronograma de Leituras & Seminários</h2>
            <p className="text-xs text-slate-500">Temas e responsáveis atribuídos na tabela leituras_responsaveis</p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {leiturasResponsaveis.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhuma leitura registrada na tabela oficial leituras_responsaveis.
              </div>
            ) : (
              leiturasResponsaveis.map((l, idx) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{l.tema || l.titulo || 'Texto de Supervisão'}</span>
                    <span className="text-[11px] text-slate-500">
                      Responsável: <strong className="text-slate-800">{l.responsavel_nome || l.responsavel_id || 'Turma em geral'}</strong>
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 self-start sm:self-auto">
                    {formatarData(l.data)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Relógio 4: Marcos Acadêmicos */}
      {relogioAtivo === 'MARCOS' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Marcos Acadêmicos e Entregas Formais</h2>
            <p className="text-xs text-slate-500">Datas limites oficiais de provas, relatórios e encerramento</p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {marcosAcademicos.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum marco acadêmico registrado no período atual.
              </div>
            ) : (
              marcosAcademicos.map(m => (
                <div key={m.marco_id} className="p-4 flex items-center justify-between gap-3 bg-white">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{m.nome}</span>
                    <span className="text-[11px] text-slate-400">Tipo: {m.tipo}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100">
                    Prazo: {formatarData(m.data_prazo)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
