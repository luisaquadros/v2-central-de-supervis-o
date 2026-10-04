import React, { useState } from 'react';
import { X, CheckCircle2, Circle, Clock, Plus, Trash2, AlertCircle, Calendar } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { ItemFilaProfessora } from '../types';

interface MinhaFilaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MinhaFilaModal: React.FC<MinhaFilaModalProps> = ({ isOpen, onClose }) => {
  const {
    filaProfessora,
    addItemFilaProfessora,
    toggleStatusFilaProfessora,
    deleteItemFilaProfessora,
    turmas,
  } = useSupervisao();

  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDuracao, setNovaDuracao] = useState<number>(15);
  const [novaPrioridade, setNovaPrioridade] = useState<'ALTA' | 'MEDIA' | 'BAIXA'>('MEDIA');
  const [novaCategoria, setNovaCategoria] = useState('Geral');
  const [novaTurmaId, setNovaTurmaId] = useState('');
  const [novoPrazo, setNovoPrazo] = useState(new Date().toISOString().split('T')[0]);
  const [mostrandoForm, setMostrandoForm] = useState(false);

  if (!isOpen) return null;

  const handleCriarItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim()) return;

    addItemFilaProfessora({
      titulo: novoTitulo.trim(),
      duracao_minutos: novaDuracao,
      prioridade: novaPrioridade,
      status: 'PENDENTE',
      categoria: novaCategoria,
      turma_id: novaTurmaId || undefined,
      prazo: novoPrazo,
    });

    setNovoTitulo('');
    setMostrandoForm(false);
  };

  const pendentes = filaProfessora.filter((i: any) => i.status !== 'CONCLUIDO');
  const concluidos = filaProfessora.filter((i: any) => i.status === 'CONCLUIDO');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Minha Fila de Trabalho ({pendentes.length})</h2>
              <p className="text-xs text-slate-500">Tarefas operacionais organizadas por tempo e prioridade</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">
            {pendentes.length} pendente(s) • {concluidos.length} concluída(s)
          </span>
          <button
            onClick={() => setMostrandoForm(!mostrandoForm)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Tarefa</span>
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* New Item Form */}
          {mostrandoForm && (
            <form onSubmit={handleCriarItem} className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Título da Tarefa</label>
                <input
                  type="text"
                  autoFocus
                  value={novoTitulo}
                  onChange={e => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Validar justificativa de falta, conferir documento..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Tempo Estimado</label>
                  <select
                    value={novaDuracao}
                    onChange={e => setNovaDuracao(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value={5}>5 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={60}>60+ min</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Prioridade</label>
                  <select
                    value={novaPrioridade}
                    onChange={e => setNovaPrioridade(e.target.value as any)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Média</option>
                    <option value="BAIXA">Baixa</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Turma</label>
                  <select
                    value={novaTurmaId}
                    onChange={e => setNovaTurmaId(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">Geral</option>
                    {turmas.map(t => (
                      <option key={t.turma_id} value={t.turma_id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Prazo</label>
                  <input
                    type="date"
                    value={novoPrazo}
                    onChange={e => setNovoPrazo(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMostrandoForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!novoTitulo.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </form>
          )}

          {/* List items */}
          <div className="space-y-2">
            {filaProfessora.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Sua fila está vazia. Adicione tarefas para organizar seu tempo.
              </div>
            ) : (
              filaProfessora.map((item: any) => {
                const isConcluido = item.status === 'CONCLUIDO';
                const turma = turmas.find(t => t.turma_id === item.turma_id);

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                      isConcluido
                        ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleStatusFilaProfessora(item.id)}
                        className="text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors"
                      >
                        {isConcluido ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div>
                        <div className={`text-xs font-bold ${isConcluido ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {item.titulo}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {item.duracao_minutos} min
                          </span>
                          {turma && <span>{turma.nome}</span>}
                          {item.prazo && <span>Prazo: {item.prazo}</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteItemFilaProfessora(item.id)}
                      className="p-1 text-slate-300 hover:text-red-600 transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
