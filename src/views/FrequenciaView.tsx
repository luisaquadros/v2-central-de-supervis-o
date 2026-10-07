import React, { useState, useMemo } from 'react';
import {
  CalendarCheck,
  AlertTriangle,
  Clock,
  Filter,
  CheckCircle2,
  Plus,
  ChevronRight,
  UserCheck,
  Calendar,
  Search,
  Smartphone,
  Check,
  AlertCircle,
  HelpCircle,
  Users,
  Grid,
  List,
  Edit2,
  X,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { Frequencia, TurmaOrigem } from '../types';

interface FrequenciaViewProps {
  onOpenAluno: (matriculaId: string, initialTab?: string) => void;
  onOpenSupervisao?: (turmaId: string) => void;
  initialSubTab?: 'grade' | 'pendencias' | 'porAluno';
}

export const FrequenciaView: React.FC<FrequenciaViewProps> = ({
  onOpenAluno,
  onOpenSupervisao,
  initialSubTab = 'grade',
}) => {
  const {
    selectedPeriodoId,
    periodos,
    getTurmasDoPeriodo,
    matriculas,
    alunos,
    frequencias,
    turmasOrigem,
    horariosTurma,
    encontrosTurma,
    updateFrequenciaStatus,
    addFrequencia,
    getChamadasPendentes,
    getSupervisaoAtual,
  } = useSupervisao();

  const currentPeriodo = periodos.find(p => p.periodo_id === selectedPeriodoId);
  const turmas = getTurmasDoPeriodo(selectedPeriodoId);

  const [activeSubTab, setActiveSubTab] = useState<'grade' | 'pendencias' | 'porAluno'>(
    initialSubTab
  );

  const [selectedTurmaId, setSelectedTurmaId] = useState<string>(() => {
    return turmas.length > 0 ? turmas[0].turma_id : '';
  });

  const [selectedMes, setSelectedMes] = useState<string>('TODOS');
  const [selectedOrigemId, setSelectedOrigemId] = useState<string>('TODAS');
  const [searchAlunoQuery, setSearchAlunoQuery] = useState('');
  const [alunoSelecionadoMatriculaId, setAlunoSelecionadoMatriculaId] = useState<string>('');

  // Modal para Justificar / Editar Frequência
  const [modalEditFreq, setModalEditFreq] = useState<{
    frequenciaId?: string;
    matriculaId: string;
    alunoNome: string;
    dataAula: string;
    statusAtual: Frequencia['status'];
    justificativaAtual: string;
    origemId?: string;
  } | null>(null);

  const activeTurma = turmas.find(t => t.turma_id === selectedTurmaId);
  const origensDaTurma = turmasOrigem.filter(o => o.turma_id === selectedTurmaId && o.ativo);

  const hojeIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const supervisaoAtual = getSupervisaoAtual();

  // Matrículas da turma filtrada por Docente Online se selecionado
  const matriculasTurma = useMemo(() => {
    return matriculas.filter(m => {
      if (m.turma_id !== selectedTurmaId || m.status !== 'MATRICULADO') return false;
      if (selectedOrigemId !== 'TODAS') {
        const matOrigem = m.origem_id || (origensDaTurma[0]?.origem_id || '');
        if (matOrigem !== selectedOrigemId) return false;
      }
      return true;
    });
  }, [matriculas, selectedTurmaId, selectedOrigemId, origensDaTurma]);

  const matriculasIds = matriculasTurma.map(m => m.matricula_id);

  // Frequências filtradas
  const frequenciasFiltradas = useMemo(() => {
    return frequencias.filter(f => {
      if (!matriculasIds.includes(f.matricula_id)) return false;
      if (selectedMes !== 'TODOS') {
        const mesRegistro = f.data_aula.split('-')[1];
        if (mesRegistro !== selectedMes) return false;
      }
      return true;
    });
  }, [frequencias, matriculasIds, selectedMes]);

  // Lista de todas as datas de aula distintas com lançamentos nesta turma
  const datasDeAula = useMemo(() => {
    const datesSet = new Set<string>();
    frequenciasFiltradas.forEach(f => datesSet.add(f.data_aula));

    // Inclui encontros já agendados ou cancelados desta turma
    encontrosTurma
      .filter(e => e.turma_id === selectedTurmaId)
      .forEach(e => {
        if (selectedMes === 'TODOS' || e.data.split('-')[1] === selectedMes) {
          datesSet.add(e.data);
        }
      });

    return Array.from(datesSet).sort();
  }, [frequenciasFiltradas, encontrosTurma, selectedTurmaId, selectedMes]);

  // Status da Chamada de Hoje para a turma ativa
  const statusChamadaHoje = useMemo(() => {
    const encontroHoje = encontrosTurma.find(
      e => e.turma_id === selectedTurmaId && e.data === hojeIso
    );
    if (encontroHoje && encontroHoje.status === 'NAO_REALIZADO') {
      return {
        status: 'NAO_REALIZADA',
        label: `Aula não realizada (${encontroHoje.motivo_nao_realizado || 'Cancelamento'})`,
        color: 'bg-amber-100 text-amber-900 border-amber-300',
      };
    }
    const chamadaSalvaHoje = frequencias.some(
      f => matriculasIds.includes(f.matricula_id) && f.data_aula === hojeIso
    );
    if (chamadaSalvaHoje) {
      return {
        status: 'SALVA',
        label: 'Chamada salva hoje',
        color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      };
    }
    return {
      status: 'PENDENTE',
      label: 'Chamada de hoje pendente',
      color: 'bg-slate-100 text-slate-800 border-slate-300',
    };
  }, [encontrosTurma, selectedTurmaId, hojeIso, frequencias, matriculasIds]);

  // Pendências de chamada
  const chamadasPendentes = getChamadasPendentes();

  // Justificativas pendentes de análise
  const justificativasPendentes = frequencias.filter(
    f => matriculasIds.includes(f.matricula_id) && f.status === 'JUSTIFICATIVA_PENDENTE'
  );

  // Faltas sem justificativa
  const faltasSemJustificativa = frequencias.filter(
    f => matriculasIds.includes(f.matricula_id) && f.status === 'FALTA_SEM_JUSTIFICATIVA'
  );

  return (
    <div className="space-y-5">
      {/* 1. TOP HEADER & COMPACT CARD "CHAMADA DE HOJE" */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Controle de Frequência Acadêmica
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Semestre {currentPeriodo?.nome} · Mapeamento integrado às turmas do Docente Online
          </p>
        </div>

        {/* COMPACT CARD: CHAMADA DE HOJE */}
        <div
          className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border text-xs shadow-2xs ${statusChamadaHoje.color}`}
        >
          <div className="flex items-center gap-2">
            {statusChamadaHoje.status === 'SALVA' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : statusChamadaHoje.status === 'NAO_REALIZADA' ? (
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            <div>
              <span className="font-bold text-slate-900 block leading-tight">
                Chamada de hoje ({hojeIso})
              </span>
              <span className="text-[11px] font-medium opacity-90">
                {statusChamadaHoje.label}
              </span>
            </div>
          </div>

          {onOpenSupervisao && (
            <button
              onClick={() => onOpenSupervisao(selectedTurmaId)}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors"
            >
              {statusChamadaHoje.status === 'SALVA' ? 'Corrigir chamada' : 'Abrir chamada'}
            </button>
          )}
        </div>
      </div>

      {/* 2. FILTROS E SUB-NAVEGAÇÃO: [GRADE] [PENDÊNCIAS] [POR ALUNO] */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* SUB-TABS */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveSubTab('grade')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
              activeSubTab === 'grade'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grade de Encontros</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pendencias')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
              activeSubTab === 'pendencias'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Pendências</span>
            {justificativasPendentes.length + chamadasPendentes.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full font-bold">
                {justificativasPendentes.length + chamadasPendentes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('porAluno')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
              activeSubTab === 'porAluno'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Por Aluno</span>
          </button>
        </div>

        {/* FILTROS DA TURMA, MÊS E DOCENTE ONLINE */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Turma filter */}
          <select
            value={selectedTurmaId}
            onChange={e => setSelectedTurmaId(e.target.value)}
            className="border border-slate-200 rounded-lg py-1.5 px-2.5 bg-slate-50 text-slate-800 font-semibold focus:outline-none cursor-pointer"
          >
            {turmas.map(t => (
              <option key={t.turma_id} value={t.turma_id}>
                {t.nome} ({t.turno})
              </option>
            ))}
          </select>

          {/* Mês filter */}
          <select
            value={selectedMes}
            onChange={e => setSelectedMes(e.target.value)}
            className="border border-slate-200 rounded-lg py-1.5 px-2 bg-slate-50 text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="TODOS">Todos os meses</option>
            <option value="08">Agosto</option>
            <option value="09">Setembro</option>
            <option value="10">Outubro</option>
            <option value="11">Novembro</option>
            <option value="12">Dezembro</option>
          </select>

          {/* Docente Online code filter */}
          {origensDaTurma.length > 0 && (
            <select
              value={selectedOrigemId}
              onChange={e => setSelectedOrigemId(e.target.value)}
              className="border border-slate-200 rounded-lg py-1.5 px-2 bg-slate-50 text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="TODAS">Todos Docente Online</option>
              {origensDaTurma.map(o => (
                <option key={o.origem_id} value={o.origem_id}>
                  {o.codigo_externo} - {o.nome_externo}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 3. CONTEÚDO DAS SUB-ABAS */}

      {/* SUB-ABA 1: GRADE (Datas × Alunos Compacta) */}
      {activeSubTab === 'grade' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Grade de Frequência da Turma
              </h3>
              <p className="text-[11px] text-slate-500">
                Visual compacto: presença discreta (•), faltas (F), atrasos (⏰) e celular (📱).
              </p>
            </div>

            {/* Legenda compacta */}
            <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Presente
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                Falta
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                Justificada
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                Pendente
              </span>
            </div>
          </div>

          {matriculasTurma.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Nenhum estudante matriculado nesta turma para o filtro selecionado.
            </div>
          ) : datasDeAula.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Nenhuma aula com frequência ou encontro lançado no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-3 sticky left-0 bg-slate-50 z-20 min-w-[170px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">
                      Estudante
                    </th>
                    <th className="py-2.5 px-2 text-center text-slate-400 font-mono text-[10px]">
                      Docente Online
                    </th>
                    {datasDeAula.map(data => {
                      const encontro = encontrosTurma.find(
                        e => e.turma_id === selectedTurmaId && e.data === data
                      );
                      const isNaoRealizada = encontro?.status === 'NAO_REALIZADO';
                      return (
                        <th
                          key={data}
                          className={`py-2.5 px-2 text-center font-mono text-[10px] min-w-[65px] border-l border-slate-100 ${
                            isNaoRealizada ? 'bg-amber-50 text-amber-900' : ''
                          }`}
                          title={isNaoRealizada ? `Não realizada: ${encontro?.motivo_nao_realizado}` : data}
                        >
                          <div>{data.slice(5)}</div>
                          {isNaoRealizada && (
                            <span className="text-[9px] text-amber-700 block font-normal">Feriado</span>
                          )}
                        </th>
                      );
                    })}
                    <th className="py-2.5 px-3 text-center border-l border-slate-200">
                      Total Faltas
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matriculasTurma.map(item => {
                    const al = alunos.find(a => a.aluno_id === item.aluno_id);
                    const matOrigem = item.origem_id
                      ? turmasOrigem.find(o => o.origem_id === item.origem_id)
                      : origensDaTurma[0];

                    const freqsDoAluno = frequenciasFiltradas.filter(
                      f => f.matricula_id === item.matricula_id
                    );
                    const totalFaltasInjustificadas = freqsDoAluno.filter(
                      f => f.status === 'FALTA_SEM_JUSTIFICATIVA'
                    ).length;

                    return (
                      <tr key={item.matricula_id} className="hover:bg-slate-50">
                        {/* Nome do aluno com link */}
                        <td className="py-2.5 px-3 sticky left-0 bg-white hover:bg-slate-50 z-10 font-medium text-slate-900 truncate">
                          <button
                            onClick={() => onOpenAluno(item.matricula_id, 'frequencia')}
                            className="text-left hover:underline truncate block w-full"
                          >
                            {al?.nome || 'Estudante'}
                          </button>
                        </td>

                        {/* Docente Online code */}
                        <td className="py-2.5 px-2 text-center font-mono text-[10px] text-slate-500">
                          {matOrigem?.codigo_externo || '—'}
                        </td>

                        {/* Células por data */}
                        {datasDeAula.map(data => {
                          const encontro = encontrosTurma.find(
                            e => e.turma_id === selectedTurmaId && e.data === data
                          );
                          const isNaoRealizada = encontro?.status === 'NAO_REALIZADO';
                          if (isNaoRealizada) {
                            return (
                              <td
                                key={data}
                                className="py-2 px-1 text-center bg-amber-50/50 border-l border-slate-100 text-slate-400 font-mono text-[10px]"
                                title="Encontro não realizado"
                              >
                                —
                              </td>
                            );
                          }

                          const freq = freqsDoAluno.find(f => f.data_aula === data);

                          return (
                            <td
                              key={data}
                              className="py-2 px-1 text-center border-l border-slate-100"
                            >
                              {!freq ? (
                                <span className="text-slate-300 font-mono text-[10px]">—</span>
                              ) : freq.status === 'PRESENTE' ? (
                                <button
                                  onClick={() =>
                                    setModalEditFreq({
                                      frequenciaId: freq.frequencia_id,
                                      matriculaId: item.matricula_id,
                                      alunoNome: al?.nome || 'Estudante',
                                      dataAula: data,
                                      statusAtual: freq.status,
                                      justificativaAtual: freq.justificativa,
                                      origemId: freq.origem_id,
                                    })
                                  }
                                  className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center justify-center font-bold text-[10px] hover:scale-110 cursor-pointer transition-transform"
                                  title={`Presente em ${data}. Clique para alterar.`}
                                >
                                  •
                                </button>
                              ) : freq.status === 'FALTA_SEM_JUSTIFICATIVA' ? (
                                <button
                                  onClick={() =>
                                    setModalEditFreq({
                                      frequenciaId: freq.frequencia_id,
                                      matriculaId: item.matricula_id,
                                      alunoNome: al?.nome || 'Estudante',
                                      dataAula: data,
                                      statusAtual: freq.status,
                                      justificativaAtual: freq.justificativa,
                                      origemId: freq.origem_id,
                                    })
                                  }
                                  className="w-5 h-5 rounded-full bg-red-600 text-white font-bold text-[10px] inline-flex items-center justify-center hover:scale-110 cursor-pointer shadow-xs transition-transform"
                                  title={`Falta em ${data}. Clique para justificar.`}
                                >
                                  F
                                </button>
                              ) : freq.status === 'FALTA_JUSTIFICADA' ? (
                                <button
                                  onClick={() =>
                                    setModalEditFreq({
                                      frequenciaId: freq.frequencia_id,
                                      matriculaId: item.matricula_id,
                                      alunoNome: al?.nome || 'Estudante',
                                      dataAula: data,
                                      statusAtual: freq.status,
                                      justificativaAtual: freq.justificativa,
                                      origemId: freq.origem_id,
                                    })
                                  }
                                  className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] inline-flex items-center justify-center hover:scale-110 cursor-pointer transition-transform"
                                  title={`Falta justificada: "${freq.justificativa}". Clique para ver.`}
                                >
                                  FJ
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    setModalEditFreq({
                                      frequenciaId: freq.frequencia_id,
                                      matriculaId: item.matricula_id,
                                      alunoNome: al?.nome || 'Estudante',
                                      dataAula: data,
                                      statusAtual: freq.status,
                                      justificativaAtual: freq.justificativa,
                                      origemId: freq.origem_id,
                                    })
                                  }
                                  className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px] inline-flex items-center justify-center hover:scale-110 cursor-pointer transition-transform"
                                  title={`Justificativa pendente: "${freq.justificativa}". Clique para analisar.`}
                                >
                                  JP
                                </button>
                              )}
                            </td>
                          );
                        })}

                        {/* Total de faltas */}
                        <td className="py-2.5 px-3 text-center border-l border-slate-200 font-mono font-bold">
                          <span
                            className={
                              totalFaltasInjustificadas > 0 ? 'text-red-700' : 'text-slate-400'
                            }
                          >
                            {totalFaltasInjustificadas}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA 2: PENDÊNCIAS (Chamadas Pendentes, Faltas sem Justificativa, Justificativas Aguardando Análise) */}
      {activeSubTab === 'pendencias' && (
        <div className="space-y-4">
          {/* SEÇÃO 1: CHAMADAS PENDENTES DA PROFESSORA */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Chamadas de Aula Pendentes de Finalização
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {chamadasPendentes.length} encontro(s) pendente(s)
              </span>
            </div>

            {chamadasPendentes.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Nenhuma chamada pendente. Todos os encontros ocorridos tiveram presença salva!
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {chamadasPendentes.map(item => (
                  <div
                    key={`${item.turma.turma_id}-${item.dataAula}`}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-red-50/20 hover:bg-red-50/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{item.turma.nome}</span>
                        <span className="font-mono text-red-700 bg-red-100 px-2 py-0.5 rounded font-semibold text-[11px]">
                          {item.diaSemanaNome}, {item.dataAula}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Horário: {item.horario?.hora_inicio || '18:30'}–
                        {item.horario?.hora_fim || '21:12'}. Esta aula ocorreu mas não teve chamada salva.
                      </p>
                    </div>

                    {onOpenSupervisao && (
                      <button
                        onClick={() => onOpenSupervisao(item.turma.turma_id)}
                        className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold text-xs cursor-pointer self-start sm:self-auto"
                      >
                        Finalizar Chamada Agora
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SEÇÃO 2: JUSTIFICATIVAS AGUARDANDO ANÁLISE */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Justificativas de Falta Aguardando Análise
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {justificativasPendentes.length} solicitação(ões)
              </span>
            </div>

            {justificativasPendentes.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Nenhuma justificativa aguardando decisão no momento.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {justificativasPendentes.map(freq => {
                  const mat = matriculas.find(m => m.matricula_id === freq.matricula_id);
                  const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;

                  return (
                    <div
                      key={freq.frequencia_id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-amber-50/30 hover:bg-amber-50/50"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{al?.nome}</span>
                          <span className="font-mono text-slate-500 text-[11px]">
                            {freq.data_aula}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-1 italic">
                          "{freq.justificativa || 'Sem texto detalhado informado'}"
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          onClick={() =>
                            updateFrequenciaStatus(
                              freq.frequencia_id,
                              'FALTA_JUSTIFICADA',
                              freq.justificativa
                            )
                          }
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs cursor-pointer"
                        >
                          Aprovar (Justificada)
                        </button>

                        <button
                          onClick={() =>
                            updateFrequenciaStatus(
                              freq.frequencia_id,
                              'FALTA_SEM_JUSTIFICATIVA',
                              freq.justificativa
                            )
                          }
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold text-xs cursor-pointer"
                        >
                          Manter Falta
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SEÇÃO 3: FALTAS SEM JUSTIFICATIVA */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Estudantes com Faltas sem Justificativa
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {faltasSemJustificativa.length} falta(s) registradas
              </span>
            </div>

            {faltasSemJustificativa.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Nenhum estudante com falta injustificada registrado nesta turma.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {faltasSemJustificativa.map(freq => {
                  const mat = matriculas.find(m => m.matricula_id === freq.matricula_id);
                  const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;

                  return (
                    <div
                      key={freq.frequencia_id}
                      className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                        <div>
                          <span className="font-bold text-slate-900">{al?.nome}</span>
                          <span className="text-slate-500 text-[11px] ml-2">
                            Data da falta: <strong className="font-mono">{freq.data_aula}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setModalEditFreq({
                            frequenciaId: freq.frequencia_id,
                            matriculaId: freq.matricula_id,
                            alunoNome: al?.nome || 'Estudante',
                            dataAula: freq.data_aula,
                            statusAtual: freq.status,
                            justificativaAtual: freq.justificativa,
                            origemId: freq.origem_id,
                          })
                        }
                        className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                      >
                        Justificar Falta
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA 3: POR ALUNO (Histórico Individual, Faltas, Atrasos, Justificativas e Correções) */}
      {activeSubTab === 'porAluno' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          {/* Busca e seleção do aluno */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar estudante pelo nome..."
                value={searchAlunoQuery}
                onChange={e => setSearchAlunoQuery(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-50 text-slate-800 focus:outline-none"
              />
            </div>

            <div className="text-xs text-slate-500">
              Total nesta turma: <strong>{matriculasTurma.length} estudantes</strong>
            </div>
          </div>

          {/* Lista detalhada do aluno selecionado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Coluna 1: Lista de Alunos para Seleção */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {matriculasTurma
                .filter(m => {
                  const al = alunos.find(a => a.aluno_id === m.aluno_id);
                  return (
                    !searchAlunoQuery ||
                    al?.nome.toLowerCase().includes(searchAlunoQuery.toLowerCase())
                  );
                })
                .map(item => {
                  const al = alunos.find(a => a.aluno_id === item.aluno_id);
                  const isSelected = item.matricula_id === alunoSelecionadoMatriculaId;
                  const freqsAluno = frequencias.filter(f => f.matricula_id === item.matricula_id);
                  const totalFaltas = freqsAluno.filter(
                    f => f.status === 'FALTA_SEM_JUSTIFICATIVA'
                  ).length;

                  return (
                    <button
                      key={item.matricula_id}
                      onClick={() => setAlunoSelecionadoMatriculaId(item.matricula_id)}
                      className={`w-full p-3 text-left flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <span className="block truncate">{al?.nome}</span>
                        <span
                          className={`text-[10px] font-mono ${
                            isSelected ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          {al?.identificador_academico}
                        </span>
                      </div>
                      {totalFaltas > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-red-500 text-white' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {totalFaltas} falta(s)
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Coluna 2 e 3: Histórico Individual do Aluno Selecionado */}
            <div className="md:col-span-2 space-y-4">
              {(() => {
                const matAtiva =
                  matriculasTurma.find(m => m.matricula_id === alunoSelecionadoMatriculaId) ||
                  matriculasTurma[0];
                if (!matAtiva) {
                  return (
                    <div className="p-8 text-center text-xs text-slate-400 border border-slate-100 rounded-xl">
                      Nenhum estudante selecionado.
                    </div>
                  );
                }

                const al = alunos.find(a => a.aluno_id === matAtiva.aluno_id);
                const matOrigem = matAtiva.origem_id
                  ? turmasOrigem.find(o => o.origem_id === matAtiva.origem_id)
                  : origensDaTurma[0];

                const freqsAluno = frequencias
                  .filter(f => f.matricula_id === matAtiva.matricula_id)
                  .sort((a, b) => b.data_aula.localeCompare(a.data_aula));

                const presentesTotal = freqsAluno.filter(f => f.status === 'PRESENTE').length;
                const faltasInjustTotal = freqsAluno.filter(
                  f => f.status === 'FALTA_SEM_JUSTIFICATIVA'
                ).length;
                const faltasJustTotal = freqsAluno.filter(
                  f => f.status === 'FALTA_JUSTIFICADA'
                ).length;
                const justPendTotal = freqsAluno.filter(
                  f => f.status === 'JUSTIFICATIVA_PENDENTE'
                ).length;
                const atrasosTotal = freqsAluno.filter(f => f.atraso).length;
                const celularTotal = freqsAluno.filter(f => f.celular).length;

                return (
                  <div className="space-y-4">
                    {/* Header do Aluno */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{al?.nome}</h4>
                          <span className="font-mono text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                            {al?.identificador_academico}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Código Docente Online:{' '}
                          <strong className="text-slate-800 font-mono">
                            {matOrigem?.codigo_externo || 'Padrão da turma'}
                          </strong>{' '}
                          ({matOrigem?.nome_externo || activeTurma?.nome})
                        </p>
                      </div>

                      <button
                        onClick={() => onOpenAluno(matAtiva.matricula_id, 'frequencia')}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        Abrir Ficha do Aluno
                      </button>
                    </div>

                    {/* Contadores */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-emerald-800 text-[10px] block">Presenças</span>
                        <strong className="text-base text-emerald-900">{presentesTotal}</strong>
                      </div>
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                        <span className="text-red-800 text-[10px] block">Faltas Injust.</span>
                        <strong className="text-base text-red-900">{faltasInjustTotal}</strong>
                      </div>
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-blue-800 text-[10px] block">Justificadas</span>
                        <strong className="text-base text-blue-900">{faltasJustTotal}</strong>
                      </div>
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="text-amber-800 text-[10px] block">Atrasos / Celular</span>
                        <strong className="text-base text-amber-900">
                          {atrasosTotal} / {celularTotal}
                        </strong>
                      </div>
                    </div>

                    {/* Tabela de Encontros do Aluno com Correção Rápida */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="p-3 bg-slate-50 border-b border-slate-200 font-semibold text-xs text-slate-800">
                        Histórico de Aulas e Frequências do Aluno
                      </div>
                      {freqsAluno.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          Nenhuma presença lançada para este estudante até o momento.
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase">
                              <th className="py-2 px-3">Data</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3">Marcadores</th>
                              <th className="py-2 px-3">Justificativa / Obs</th>
                              <th className="py-2 px-3 text-right">Corrigir</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {freqsAluno.map(freq => (
                              <tr key={freq.frequencia_id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                  {freq.data_aula}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      freq.status === 'PRESENTE'
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : freq.status === 'FALTA_JUSTIFICADA'
                                        ? 'bg-blue-100 text-blue-900'
                                        : freq.status === 'JUSTIFICATIVA_PENDENTE'
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-red-100 text-red-900'
                                    }`}
                                  >
                                    {freq.status.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1.5">
                                    {freq.atraso && (
                                      <span
                                        className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded flex items-center gap-0.5"
                                        title="Atraso"
                                      >
                                        ⏰ Atraso
                                      </span>
                                    )}
                                    {freq.celular && (
                                      <span
                                        className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded flex items-center gap-0.5"
                                        title="Celular"
                                      >
                                        📱 Celular
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                                  {freq.justificativa || freq.observacao || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() =>
                                      setModalEditFreq({
                                        frequenciaId: freq.frequencia_id,
                                        matriculaId: matAtiva.matricula_id,
                                        alunoNome: al?.nome || 'Estudante',
                                        dataAula: freq.data_aula,
                                        statusAtual: freq.status,
                                        justificativaAtual: freq.justificativa,
                                        origemId: freq.origem_id,
                                      })
                                    }
                                    className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                    title="Corrigir presença/justificativa"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CORRIGIR / EDITAR FREQUÊNCIA DE UM ALUNO */}
      {modalEditFreq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Editar Frequência — {modalEditFreq.alunoNome}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Data da Aula: <strong className="font-mono">{modalEditFreq.dataAula}</strong>
                </p>
              </div>
              <button
                onClick={() => setModalEditFreq(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Status de Frequência</label>
                <select
                  value={modalEditFreq.statusAtual}
                  onChange={e =>
                    setModalEditFreq(prev =>
                      prev ? { ...prev, statusAtual: e.target.value as Frequencia['status'] } : null
                    )
                  }
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-xs font-semibold text-slate-800"
                >
                  <option value="PRESENTE">Presente</option>
                  <option value="FALTA_SEM_JUSTIFICATIVA">Falta sem justificativa</option>
                  <option value="FALTA_JUSTIFICADA">Falta justificada</option>
                  <option value="JUSTIFICATIVA_PENDENTE">Justificativa pendente de envio</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Texto da Justificativa
                </label>
                <textarea
                  rows={2}
                  value={modalEditFreq.justificativaAtual}
                  onChange={e =>
                    setModalEditFreq(prev =>
                      prev ? { ...prev, justificativaAtual: e.target.value } : null
                    )
                  }
                  placeholder="Ex: Atestado médico comprovado..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setModalEditFreq(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (modalEditFreq.frequenciaId) {
                    await updateFrequenciaStatus(
                      modalEditFreq.frequenciaId,
                      modalEditFreq.statusAtual,
                      modalEditFreq.justificativaAtual
                    );
                  } else {
                    await addFrequencia(
                      modalEditFreq.matriculaId,
                      modalEditFreq.dataAula,
                      modalEditFreq.statusAtual,
                      modalEditFreq.justificativaAtual,
                      modalEditFreq.origemId
                    );
                  }
                  setModalEditFreq(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer"
              >
                Salvar Alteração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
