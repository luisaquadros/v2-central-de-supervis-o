import React, { useState } from 'react';
import { X, Clock, Check, Trash2, Edit2, AlertCircle, User, Calendar, FileText } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { CaixaEntradaItem } from '../types';

interface CaixaEntradaPendenteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNovoRegistro: () => void;
}

export const CaixaEntradaPendenteModal: React.FC<CaixaEntradaPendenteModalProps> = ({
  isOpen,
  onClose,
  onOpenNovoRegistro,
}) => {
  const {
    caixaEntrada,
    alunos,
    turmas,
    confirmarCaixaEntradaItem,
    descartarCaixaEntradaItem,
  } = useSupervisao();

  const [resolvendoId, setResolvendoId] = useState<string | null>(null);
  const [targetAlunoId, setTargetAlunoId] = useState('');
  const [targetTurmaId, setTargetTurmaId] = useState('');
  const [targetTipo, setTargetTipo] = useState('JUSTIFICATIVA_FALTA');
  const [targetData, setTargetData] = useState(new Date().toISOString().split('T')[0]);
  const [targetObs, setTargetObs] = useState('');

  if (!isOpen) return null;

  const itensPendentes = caixaEntrada.filter((i: any) => i.status === 'PENDENTE');

  const handleIniciarResolucao = (item: CaixaEntradaItem) => {
    setResolvendoId(item.id);
    setTargetAlunoId(item.aluno_id || '');
    setTargetTurmaId(item.turma_id || '');
    setTargetTipo(item.tipo_sugerido || 'JUSTIFICATIVA_FALTA');
    setTargetData(item.data_relacionada || new Date().toISOString().split('T')[0]);
    setTargetObs(item.observacao || item.texto_original);
  };

  const handleSalvarResolucao = async (itemId: string) => {
    await confirmarCaixaEntradaItem(itemId, {
      aluno_id: targetAlunoId || undefined,
      turma_id: targetTurmaId || undefined,
      tipo_sugerido: targetTipo,
      data_relacionada: targetData,
      observacao: targetObs,
    });
    setResolvendoId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Caixa de Entrada Pendente ({itensPendentes.length})
              </h2>
              <p className="text-xs text-slate-500">Registros capturados para organizar ou classificar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {itensPendentes.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Caixa de entrada limpa!</p>
              <p className="text-xs text-slate-400">Nenhum registro pendente para resolver no momento.</p>
              <button
                onClick={() => {
                  onClose();
                  onOpenNovoRegistro();
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                + Novo Registro Rápido
              </button>
            </div>
          ) : (
            itensPendentes.map((item: any) => {
              const emEdicao = resolvendoId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {item.tipo_sugerido || 'Anotação Geral'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.criado_em).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(item.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {!emEdicao && (
                        <button
                          onClick={() => handleIniciarResolucao(item)}
                          className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Classificar</span>
                        </button>
                      )}
                      <button
                        onClick={() => descartarCaixaEntradaItem(item.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Descartar anotação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {!emEdicao ? (
                    <div className="text-xs text-slate-800 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                      "{item.texto_original}"
                    </div>
                  ) : (
                    <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Estudante</label>
                          <select
                            value={targetAlunoId}
                            onChange={e => setTargetAlunoId(e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="">Selecione...</option>
                            {alunos.map(a => (
                              <option key={a.aluno_id} value={a.aluno_id}>
                                {a.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Tipo</label>
                          <select
                            value={targetTipo}
                            onChange={e => setTargetTipo(e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="JUSTIFICATIVA_FALTA">Justificativa de Falta</option>
                            <option value="ORIENTACAO">Orientação Acadêmica</option>
                            <option value="DOCUMENTO_ENTREGUE">Entrega de Documento</option>
                            <option value="OCORRENCIA">Ocorrência em Aula</option>
                            <option value="TAREFA_PROFESSORA">Tarefa da Professora</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Observação Final</label>
                        <input
                          type="text"
                          value={targetObs}
                          onChange={e => setTargetObs(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => setResolvendoId(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSalvarResolucao(item.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirmar e Salvar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
