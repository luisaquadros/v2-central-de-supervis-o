import React, { useState } from 'react';
import { Calendar, Plus, CheckCircle2, Copy, AlertCircle, Archive } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

export const SemestresView: React.FC = () => {
  const { periodos, selectedPeriodoId, setSelectedPeriodoId, turmas, createNovoPeriodo } =
    useSupervisao();

  const [modalNovoPeriodo, setModalNovoPeriodo] = useState(false);
  const [novoNome, setNovoNome] = useState('2027.2');
  const [novaDataInicio, setNovaDataInicio] = useState('2027-08-01');
  const [novaDataFim, setNovaDataFim] = useState('2027-12-20');
  const [copiarDePeriodoId, setCopiarDePeriodoId] = useState(selectedPeriodoId);

  const handleCriarSemestre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    const newId = await createNovoPeriodo(
      novoNome.trim(),
      novaDataInicio,
      novaDataFim,
      copiarDePeriodoId || undefined
    );
    setSelectedPeriodoId(newId);
    setModalNovoPeriodo(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Gestão Multi-Semestre
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Preservação de histórico e assistente para abertura de novos períodos letivos
          </p>
        </div>

        <button
          onClick={() => setModalNovoPeriodo(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Período Letivo</span>
        </button>
      </div>

      {/* Regra de Ouro Multi-Semestre */}
      <div className="p-4 rounded-xl bg-slate-900 text-white text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-amber-400">
          <AlertCircle className="w-4 h-4" />
          <span>Princípio Fundamental dos Dados Acadêmicos</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          Ao abrir um novo semestre, o sistema permite copiar a <strong>estrutura</strong> (disciplinas,
          turmas e critérios de notas), mas <strong>NUNCA</strong> transfere dados individuais de
          alunos. O novo semestre começa 100% zerado em notas, atrasos, orientações, registros e
          documentos, mantendo o histórico anterior preservado e intocado.
        </p>
      </div>

      {/* Lista de Períodos Letivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {periodos.map(periodo => {
          const isSelected = periodo.periodo_id === selectedPeriodoId;
          const turmasDoPeriodo = turmas.filter(t => t.periodo_id === periodo.periodo_id);

          return (
            <div
              key={periodo.periodo_id}
              className={`p-5 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                isSelected
                  ? 'border-slate-900 bg-white shadow-sm ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`font-bold text-base ${
                      isSelected ? 'text-slate-900' : 'text-slate-800'
                    }`}
                  >
                    Semestre {periodo.nome}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                      periodo.status === 'ATIVO'
                        ? 'bg-emerald-100 text-emerald-900'
                        : periodo.status === 'PLANEJADO'
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {periodo.status}
                  </span>
                </div>

                <div className="text-slate-500 space-y-1 mt-3">
                  <p>
                    Vigência:{' '}
                    <span className="font-mono text-slate-800 font-medium">
                      {periodo.data_inicio} até {periodo.data_fim}
                    </span>
                  </p>
                  <p>
                    Estrutura:{' '}
                    <span className="font-semibold text-slate-800">
                      {turmasDoPeriodo.length} turmas cadastradas
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {isSelected ? '✓ Contexto Atual Ativo' : 'Histórico consultável'}
                </span>

                <button
                  onClick={() => setSelectedPeriodoId(periodo.periodo_id)}
                  disabled={isSelected}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {isSelected ? 'Selecionado' : 'Ativar Este Período'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Assistente Novo Semestre */}
      {modalNovoPeriodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Assistente de Novo Período Letivo
            </h3>
            <p className="text-slate-500">
              Configure as datas e escolha se deseja copiar a grade de turmas do semestre anterior.
            </p>

            <form onSubmit={handleCriarSemestre} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nome do Período (Ex: 2027.2)
                </label>
                <input
                  type="text"
                  required
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Data Início</label>
                  <input
                    type="date"
                    required
                    value={novaDataInicio}
                    onChange={e => setNovaDataInicio(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Data Término</label>
                  <input
                    type="date"
                    required
                    value={novaDataFim}
                    onChange={e => setNovaDataFim(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Copiar Estrutura de Turmas de:
                </label>
                <select
                  value={copiarDePeriodoId}
                  onChange={e => setCopiarDePeriodoId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 font-medium"
                >
                  <option value="">Não copiar estrutura (começar vazio)</option>
                  {periodos.map(p => (
                    <option key={p.periodo_id} value={p.periodo_id}>
                      Copiar turmas e critérios de {p.nome}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Apenas as disciplinas e critérios de avaliação serão duplicados. Os alunos começarão
                  zerados.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovoPeriodo(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800"
                >
                  Criar Semestre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
