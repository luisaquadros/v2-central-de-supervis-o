import React, { useState } from 'react';
import {
  Users,
  Play,
  Clock,
  Plus,
  ArrowLeft,
  CalendarCheck,
  Edit2,
  Archive,
  ArchiveRestore,
  X,
  Check,
  Trash2,
} from 'lucide-react';
import { useSupervisao, NovoHorarioInput, NovaOrigemInput } from '../context/SupervisaoContext';
import { Turma } from '../types';

interface TurmasViewProps {
  onSelectTurma: (turmaId: string) => void;
  onIniciarSupervisao: (turmaId: string) => void;
  onOpenAluno: (matriculaId: string) => void;
}

export const TurmasView: React.FC<TurmasViewProps> = ({
  onSelectTurma,
  onIniciarSupervisao,
}) => {
  const {
    selectedPeriodoId,
    periodos,
    getTurmasDoPeriodo,
    disciplinas,
    matriculas,
    horariosTurma,
    turmasOrigem,
    orientacoes,
    documentos,
    addTurma,
    updateTurma,
    toggleArchiveTurma,
  } = useSupervisao();

  const [filtroStatus, setFiltroStatus] = useState<'ATIVAS' | 'ARQUIVADAS' | 'TODAS'>('ATIVAS');
  const [modalTurmaOpen, setModalTurmaOpen] = useState(false);
  const [turmaEmEdicao, setTurmaEmEdicao] = useState<Turma | null>(null);

  const currentPeriodo = periodos.find(p => p.periodo_id === selectedPeriodoId);
  const todasTurmasPeriodo = getTurmasDoPeriodo(selectedPeriodoId, true);

  const turmasExibidas = todasTurmasPeriodo.filter(t => {
    if (filtroStatus === 'ATIVAS') return t.status !== 'ARQUIVADO';
    if (filtroStatus === 'ARQUIVADAS') return t.status === 'ARQUIVADO';
    return true;
  });

  const turmasAtivasCount = todasTurmasPeriodo.filter(t => t.status !== 'ARQUIVADO').length;
  const turmasArquivadasCount = todasTurmasPeriodo.filter(t => t.status === 'ARQUIVADO').length;

  const diasSemanaNome = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];

  const handleOpenNovaTurma = () => {
    setTurmaEmEdicao(null);
    setModalTurmaOpen(true);
  };

  const handleOpenEditarTurma = (turma: Turma, e: React.MouseEvent) => {
    e.stopPropagation();
    setTurmaEmEdicao(turma);
    setModalTurmaOpen(true);
  };

  const handleToggleArchive = async (turmaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleArchiveTurma(turmaId);
  };

  return (
    <div className="space-y-6">
      {/* Header com Ação de Criar Turma Dinâmica */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Turmas de Estágio</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Semestre {currentPeriodo?.nome} · Gestão dinâmica de turmas, disciplinas e horários
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNovaTurma}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Turma</span>
          </button>
        </div>
      </div>

      {/* Filtros de Status */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFiltroStatus('ATIVAS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filtroStatus === 'ATIVAS'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Turmas Ativas ({turmasAtivasCount})
        </button>
        <button
          onClick={() => setFiltroStatus('ARQUIVADAS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filtroStatus === 'ARQUIVADAS'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Arquivadas ({turmasArquivadasCount})
        </button>
        <button
          onClick={() => setFiltroStatus('TODAS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filtroStatus === 'TODAS'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todas ({todasTurmasPeriodo.length})
        </button>
      </div>

      {/* Grid de Turmas */}
      {turmasExibidas.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">Nenhuma turma encontrada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {filtroStatus === 'ARQUIVADAS'
              ? 'Não há turmas arquivadas neste período.'
              : 'Cadastre sua primeira turma para vincular disciplina, horários e alunos.'}
          </p>
          {filtroStatus !== 'ARQUIVADAS' && (
            <button
              onClick={handleOpenNovaTurma}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Turma Agora</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {turmasExibidas.map(turma => {
            const disc = disciplinas.find(d => d.disciplina_id === turma.disciplina_id);
            const mats = matriculas.filter(
              m => m.turma_id === turma.turma_id && m.status === 'MATRICULADO'
            );
            const matIds = mats.map(m => m.matricula_id);
            const horarios = horariosTurma.filter(h => h.turma_id === turma.turma_id && h.ativo);
            const origens = turmasOrigem.filter(o => o.turma_id === turma.turma_id && o.ativo);

            const pendDocs = documentos.filter(
              d => matIds.includes(d.matricula_id) && d.status === 'PENDENTE'
            ).length;
            const oriAbertas = orientacoes.filter(
              o => matIds.includes(o.matricula_id) && o.status === 'ABERTA'
            ).length;

            const isArquivada = turma.status === 'ARQUIVADO';

            return (
              <div
                key={turma.turma_id}
                className={`bg-white border rounded-xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                  isArquivada
                    ? 'border-slate-200 bg-slate-50/70 opacity-80'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-700">{disc?.nome || 'Disciplina'}</span>
                    <div className="flex items-center gap-1.5">
                      {isArquivada && (
                        <span className="bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded text-[10px]">
                          ARQUIVADA
                        </span>
                      )}
                      <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                        {turma.turno}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">{turma.nome}</h3>

                  {/* Horários */}
                  <div className="space-y-1 mb-3">
                    {horarios.length > 0 ? (
                      horarios.map(h => (
                        <div key={h.horario_id} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {diasSemanaNome[h.dia_semana]} ·{' '}
                            <span className="font-mono font-medium text-slate-800">
                              {h.hora_inicio} às {h.hora_fim}
                            </span>
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400">Sem horário cadastrado</div>
                    )}
                  </div>

                  {/* Códigos Docente Online */}
                  {origens.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap pt-2 border-t border-slate-100">
                      <span className="text-slate-400">Docente Online:</span>
                      {origens.map(orig => (
                        <span
                          key={orig.origem_id}
                          className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                        >
                          {orig.codigo_externo}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Indicadores Rápidos */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold">{mats.length} alunos</span>
                    </div>
                    {pendDocs > 0 && (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium">
                        {pendDocs} doc. pendente
                      </span>
                    )}
                    {oriAbertas > 0 && (
                      <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                        {oriAbertas} orient. aberta
                      </span>
                    )}
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSelectTurma(turma.turma_id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={e => handleOpenEditarTurma(turma, e)}
                      title="Editar Turma"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => handleToggleArchive(turma.turma_id, e)}
                      title={isArquivada ? 'Desarquivar Turma' : 'Arquivar Turma (sem apagar dados)'}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {isArquivada ? (
                        <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => onIniciarSupervisao(turma.turma_id)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer active:scale-98 shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Modo Supervisão</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Turma */}
      {modalTurmaOpen && (
        <ModalTurmaForm
          turma={turmaEmEdicao}
          onClose={() => setModalTurmaOpen(false)}
          onSave={async dados => {
            if (turmaEmEdicao) {
              await updateTurma(turmaEmEdicao.turma_id, dados);
            } else {
              await addTurma(dados);
            }
            setModalTurmaOpen(false);
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// MODAL DE FORMULÁRIO DE TURMA DINÂMICA
// ==========================================
interface ModalTurmaFormProps {
  turma: Turma | null;
  onClose: () => void;
  onSave: (dados: {
    disciplina_id: string;
    nome: string;
    turno: 'MATUTINO' | 'NOTURNO' | 'VESPERTINO' | 'INTEGRAL';
    status?: 'ATIVO' | 'ENCERRADO' | 'ARQUIVADO';
    horarios?: NovoHorarioInput[];
    origens?: NovaOrigemInput[];
  }) => Promise<void>;
}

const ModalTurmaForm: React.FC<ModalTurmaFormProps> = ({ turma, onClose, onSave }) => {
  const { disciplinas, horariosTurma, turmasOrigem } = useSupervisao();

  const [disciplinaId, setDisciplinaId] = useState(
    turma ? turma.disciplina_id : disciplinas[0]?.disciplina_id || ''
  );
  const [nome, setNome] = useState(turma ? turma.nome : '');
  const [turno, setTurno] = useState<'MATUTINO' | 'NOTURNO' | 'VESPERTINO' | 'INTEGRAL'>(
    turma ? turma.turno : 'MATUTINO'
  );
  const [status, setStatus] = useState<'ATIVO' | 'ENCERRADO' | 'ARQUIVADO'>(
    turma ? turma.status : 'ATIVO'
  );

  // Horários existentes ou default
  const horariosIniciais = turma
    ? horariosTurma
        .filter(h => h.turma_id === turma.turma_id)
        .map(h => ({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim }))
    : [{ dia_semana: 1, hora_inicio: '08:20', hora_fim: '11:00' }];

  const [horarios, setHorarios] = useState<NovoHorarioInput[]>(horariosIniciais);

  // Origem Docente Online
  const origensIniciais = turma
    ? turmasOrigem
        .filter(o => o.turma_id === turma.turma_id)
        .map(o => ({
          sistema: o.sistema,
          codigo_externo: o.codigo_externo,
          nome_externo: o.nome_externo,
        }))
    : [{ sistema: 'Docente Online', codigo_externo: '', nome_externo: '' }];

  const [origens, setOrigens] = useState<NovaOrigemInput[]>(origensIniciais);
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !disciplinaId) return;

    setSalvando(true);
    try {
      await onSave({
        disciplina_id: disciplinaId,
        nome: nome.trim(),
        turno,
        status,
        horarios: horarios.filter(h => h.hora_inicio && h.hora_fim),
        origens: origens.filter(o => o.codigo_externo.trim()),
      });
    } finally {
      setSalvando(false);
    }
  };

  const addHorario = () => {
    setHorarios(prev => [...prev, { dia_semana: 2, hora_inicio: '18:30', hora_fim: '21:12' }]);
  };

  const removeHorario = (index: number) => {
    setHorarios(prev => prev.filter((_, i) => i !== index));
  };

  const updateHorario = (index: number, campo: keyof NovoHorarioInput, valor: any) => {
    setHorarios(prev =>
      prev.map((h, i) => (i === index ? { ...h, [campo]: valor } : h))
    );
  };

  const addOrigem = () => {
    setOrigens(prev => [
      ...prev,
      { sistema: 'Docente Online', codigo_externo: '', nome_externo: '' },
    ]);
  };

  const removeOrigem = (index: number) => {
    setOrigens(prev => prev.filter((_, i) => i !== index));
  };

  const updateOrigem = (index: number, campo: keyof NovaOrigemInput, valor: string) => {
    setOrigens(prev =>
      prev.map((o, i) => (i === index ? { ...o, [campo]: valor } : o))
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              {turma ? 'Editar Turma' : 'Cadastrar Nova Turma'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina a disciplina, horários de supervisão e códigos do Docente Online
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Disciplina Vinculada */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Disciplina Vinculada (DISCIPLINA ≠ TURMA)
            </label>
            <select
              value={disciplinaId}
              onChange={e => setDisciplinaId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
              required
            >
              {disciplinas.map(d => (
                <option key={d.disciplina_id} value={d.disciplina_id}>
                  {d.nome} ({d.codigo}) · {d.tipo}
                </option>
              ))}
            </select>
          </div>

          {/* Nome da Turma */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Nome da Turma</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Clínica Adulto - Matutino"
              className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
              required
            />
          </div>

          {/* Turno e Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Turno</label>
              <select
                value={turno}
                onChange={e => setTurno(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
              >
                <option value="MATUTINO">Matutino</option>
                <option value="NOTURNO">Noturno</option>
                <option value="VESPERTINO">Vespertino</option>
                <option value="INTEGRAL">Integral</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
              >
                <option value="ATIVO">Ativa</option>
                <option value="ARQUIVADO">Arquivada</option>
                <option value="ENCERRADO">Encerrada</option>
              </select>
            </div>
          </div>

          {/* Horários da Turma */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-slate-700">Horários Semanais da Aula</label>
              <button
                type="button"
                onClick={addHorario}
                className="text-[11px] text-slate-700 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Adicionar Dia/Horário</span>
              </button>
            </div>

            <div className="space-y-2">
              {horarios.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <select
                    value={h.dia_semana}
                    onChange={e => updateHorario(idx, 'dia_semana', parseInt(e.target.value, 10))}
                    className="border border-slate-200 rounded p-1.5 bg-white text-xs"
                  >
                    <option value={1}>Segunda-feira</option>
                    <option value={2}>Terça-feira</option>
                    <option value={3}>Quarta-feira</option>
                    <option value={4}>Quinta-feira</option>
                    <option value={5}>Sexta-feira</option>
                    <option value={6}>Sábado</option>
                  </select>

                  <input
                    type="time"
                    value={h.hora_inicio}
                    onChange={e => updateHorario(idx, 'hora_inicio', e.target.value)}
                    className="border border-slate-200 rounded p-1 bg-white font-mono text-xs w-24"
                  />
                  <span className="text-slate-400">às</span>
                  <input
                    type="time"
                    value={h.hora_fim}
                    onChange={e => updateHorario(idx, 'hora_fim', e.target.value)}
                    className="border border-slate-200 rounded p-1 bg-white font-mono text-xs w-24"
                  />

                  {horarios.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHorario(idx)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Vínculo Docente Online */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-slate-700">Códigos do Docente Online</label>
              <button
                type="button"
                onClick={addOrigem}
                className="text-[11px] text-slate-700 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Adicionar Código</span>
              </button>
            </div>

            <div className="space-y-2">
              {origens.map((orig, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <input
                    type="text"
                    value={orig.codigo_externo}
                    onChange={e => updateOrigem(idx, 'codigo_externo', e.target.value)}
                    placeholder="Ex: PSIC-101-A"
                    className="border border-slate-200 rounded p-1.5 bg-white font-mono text-xs flex-1 uppercase"
                  />
                  <input
                    type="text"
                    value={orig.nome_externo}
                    onChange={e => updateOrigem(idx, 'nome_externo', e.target.value)}
                    placeholder="Descrição institucional"
                    className="border border-slate-200 rounded p-1.5 bg-white text-xs flex-1"
                  />
                  {origens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOrigem(idx)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Botões do Rodapé */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-2"
            >
              {salvando ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar Turma</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// PÁGINA DA TURMA (Detalhes da Turma com Tabs)
// ==========================================
export const TurmaDetalheView: React.FC<{
  turmaId: string;
  onVoltar: () => void;
  onIniciarSupervisao: (turmaId: string) => void;
  onOpenAluno: (matriculaId: string) => void;
}> = ({ turmaId, onVoltar, onIniciarSupervisao, onOpenAluno }) => {
  const {
    turmas,
    disciplinas,
    periodos,
    getAlunosDaTurma,
    getResumoAlunoSupervisao,
    horariosTurma,
    turmasOrigem,
    marcosAcademicos,
    frequencias,
    avaliacoes,
    updateTurma,
    toggleArchiveTurma,
  } = useSupervisao();

  const [activeTab, setActiveTab] = useState<'geral' | 'alunos' | 'frequencia' | 'pendencias' | 'avaliacao'>('geral');
  const [modalEditarOpen, setModalEditarOpen] = useState(false);

  const turma = turmas.find(t => t.turma_id === turmaId);
  const disciplina = disciplinas.find(d => d.disciplina_id === turma?.disciplina_id);
  const periodo = periodos.find(p => p.periodo_id === turma?.periodo_id);
  const alunosTurma = getAlunosDaTurma(turmaId);
  const horarios = horariosTurma.filter(h => h.turma_id === turmaId && h.ativo);
  const origens = turmasOrigem.filter(o => o.turma_id === turmaId && o.ativo);

  const marcosTurma = marcosAcademicos.filter(
    m => m.turma_id === turmaId || (m.disciplina_id === turma?.disciplina_id && !m.turma_id)
  );

  const diasSemanaNome = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];

  if (!turma) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Turma não encontrada.
        <button onClick={onVoltar} className="block mx-auto mt-2 text-slate-900 underline">
          Voltar
        </button>
      </div>
    );
  }

  const isArquivada = turma.status === 'ARQUIVADO';

  return (
    <div className="space-y-5">
      {/* Header com Botões de Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onVoltar}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            title="Voltar para Turmas"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {disciplina?.nome} · Turno {turma.turno} · Período {periodo?.nome}
              </span>
              {isArquivada && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  ARQUIVADA
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{turma.nome}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalEditarOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Editar Turma</span>
          </button>

          <button
            onClick={() => toggleArchiveTurma(turma.turma_id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            {isArquivada ? (
              <>
                <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reativar</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>Arquivar</span>
              </>
            )}
          </button>

          <button
            onClick={() => onIniciarSupervisao(turmaId)}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-98"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>MODO SUPERVISÃO</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto shadow-xs">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: 'geral', label: 'Visão Geral' },
            { id: 'alunos', label: `Alunos (${alunosTurma.length})` },
            { id: 'frequencia', label: 'Frequência' },
            { id: 'pendencias', label: 'Pendências' },
            { id: 'avaliacao', label: 'Avaliação' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === t.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. ABA: VISÃO GERAL */}
      {activeTab === 'geral' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Programação de Aulas */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <span>Programação Semanal de Aulas</span>
            </h3>
            {horarios.length === 0 ? (
              <p className="text-slate-400">Nenhum horário cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {horarios.map(h => (
                  <div
                    key={h.horario_id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between"
                  >
                    <span className="font-semibold text-slate-800">
                      {diasSemanaNome[h.dia_semana]}
                    </span>
                    <span className="font-mono text-slate-700 font-medium">
                      {h.hora_inicio} às {h.hora_fim}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Integração Docente Online */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-slate-600" />
              <span>Códigos Vinculados no Docente Online</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Uma turma lógica da Central pode corresponder a múltiplos códigos do sistema institucional.
            </p>
            {origens.length === 0 ? (
              <p className="text-slate-400">Nenhum código externo mapeado.</p>
            ) : (
              <div className="space-y-2">
                {origens.map(o => (
                  <div
                    key={o.origem_id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900">{o.codigo_externo}</div>
                      <div className="text-[11px] text-slate-500">{o.nome_externo}</div>
                    </div>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {o.sistema}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Marcos da Turma */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 md:col-span-2">
            <h3 className="font-bold text-slate-900">Marcos e Prazos Específicos</h3>
            {marcosTurma.length === 0 ? (
              <p className="text-slate-400">Nenhum marco cadastrado.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {marcosTurma.map(m => (
                  <div key={m.marco_id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{m.nome}</div>
                      <div className="text-[11px] text-slate-400">{m.observacao}</div>
                    </div>
                    <span className="font-mono font-medium text-slate-700">{m.data_prazo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ABA: ALUNOS */}
      {activeTab === 'alunos' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {alunosTurma.map(({ matricula, aluno }) => {
              const resumo = getResumoAlunoSupervisao(matricula.matricula_id);
              return (
                <div
                  key={matricula.matricula_id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs">
                      {aluno.nome.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{aluno.nome}</span>
                        {resumo?.temAtencao && (
                          <span className="text-amber-500 font-bold" title="Requer atenção">
                            ⚠
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px]">
                        {aluno.identificador_academico}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-slate-500">Registros</div>
                      <div className="font-mono font-bold text-slate-900">
                        {resumo?.totalRegistrosEntregues} / 12
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-slate-500">Faltas s/ just.</div>
                      <div className="font-mono font-bold text-slate-900">
                        {resumo?.faltasInjustificadasCount}
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenAluno(matricula.matricula_id)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 transition-colors cursor-pointer"
                    >
                      Abrir Ficha
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. ABA: FREQUÊNCIA */}
      {activeTab === 'frequencia' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Frequência da Turma</h3>
            <span className="text-slate-400">Total de estudantes: {alunosTurma.length}</span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {alunosTurma.map(({ matricula, aluno }) => {
              const freqs = frequencias.filter(f => f.matricula_id === matricula.matricula_id);
              const injust = freqs.filter(f => f.status === 'FALTA_SEM_JUSTIFICATIVA').length;

              return (
                <div key={matricula.matricula_id} className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{aluno.nome}</span>
                    <div className="text-[11px] text-slate-400">
                      {freqs.length} aulas registradas
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-600">
                      {injust > 0 ? (
                        <span className="text-red-600 font-bold">{injust} falta(s)</span>
                      ) : (
                        <span className="text-emerald-600">Sem faltas</span>
                      )}
                    </span>
                    <button
                      onClick={() => onOpenAluno(matricula.matricula_id)}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Ver detalhes
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. ABA: PENDÊNCIAS */}
      {activeTab === 'pendencias' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-xs space-y-3">
          <h3 className="font-bold text-slate-900">Pendências Desta Turma</h3>
          <p className="text-slate-500">
            Alunos desta turma que necessitam de providências (documentos ou orientações).
          </p>

          <div className="divide-y divide-slate-100">
            {alunosTurma
              .filter(({ matricula }) => {
                const resumo = getResumoAlunoSupervisao(matricula.matricula_id);
                return resumo?.temAtencao;
              })
              .map(({ matricula, aluno }) => {
                const resumo = getResumoAlunoSupervisao(matricula.matricula_id);
                return (
                  <div key={matricula.matricula_id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{aluno.nome}</span>
                        <span className="text-amber-500">⚠</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 space-x-3">
                        {resumo?.docsPendentesCount ? (
                          <span className="text-amber-700">
                            {resumo.docsPendentesCount} doc(s) pendente(s)
                          </span>
                        ) : null}
                        {resumo?.orientacoesAbertasCount ? (
                          <span>{resumo.orientacoesAbertasCount} orientação aberta</span>
                        ) : null}
                        {resumo?.faltasInjustificadasCount ? (
                          <span className="text-red-600">{resumo.faltasInjustificadasCount} falta(s)</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenAluno(matricula.matricula_id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                    >
                      Atender
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 5. ABA: AVALIAÇÃO */}
      {activeTab === 'avaliacao' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-xs space-y-4">
          <h3 className="font-bold text-slate-900">Quadro de Notas da Turma</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                  <th className="py-2">Aluno</th>
                  <th className="py-2 text-right">Nota Final</th>
                  <th className="py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alunosTurma.map(({ matricula, aluno }) => {
                  const studentAvals = avaliacoes.filter(a => a.matricula_id === matricula.matricula_id);
                  const total = studentAvals.reduce((acc, a) => acc + a.nota, 0);

                  return (
                    <tr key={matricula.matricula_id}>
                      <td className="py-3 font-semibold text-slate-800">{aluno.nome}</td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900">
                        {total > 0 ? `${total.toFixed(1)} / 10.0` : '—'}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => onOpenAluno(matricula.matricula_id)}
                          className="text-xs text-slate-600 hover:underline"
                        >
                          Lançar notas
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Edição da Turma Atual */}
      {modalEditarOpen && (
        <ModalTurmaForm
          turma={turma}
          onClose={() => setModalEditarOpen(false)}
          onSave={async dados => {
            await updateTurma(turma.turma_id, dados);
            setModalEditarOpen(false);
          }}
        />
      )}
    </div>
  );
};
