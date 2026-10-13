import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

interface ModalWrapperProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  title,
  subtitle,
  onClose,
  children,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4 text-xs">{children}</div>
      </div>
    </div>
  );
};

// 1. Modal Nova Orientação
export const ModalNovaOrientacao: React.FC<{
  matriculaId: string;
  alunoNome: string;
  onClose: () => void;
  onSaved?: () => void;
}> = ({ matriculaId, alunoNome, onClose, onSaved }) => {
  const { addOrientacao } = useSupervisao();
  const [categoria, setCategoria] = useState('Clínica');
  const [texto, setTexto] = useState('');
  const [status, setStatus] = useState<'ABERTA' | 'CONCLUÍDA'>('ABERTA');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    addOrientacao(matriculaId, categoria, texto.trim(), status);
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <ModalWrapper
      title="Nova Orientação"
      subtitle={`Aluno(a): ${alunoNome}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Categoria</label>
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="Clínica">Clínica</option>
            <option value="Geral">Geral</option>
            <option value="Ética">Ética</option>
            <option value="Metodologia">Metodologia</option>
            <option value="Relatório">Relatório</option>
            <option value="Manejo">Manejo</option>
          </select>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">
            Orientações Fornecidas
          </label>
          <textarea
            required
            rows={4}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Descreva a orientação dada ao estagiário..."
            className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Status Inicial</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatus('ABERTA')}
              className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                status === 'ABERTA'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              Aberta (Em acompanhamento)
            </button>
            <button
              type="button"
              onClick={() => setStatus('CONCLUÍDA')}
              className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                status === 'CONCLUÍDA'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              Concluída (Resolvida)
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
          >
            Salvar Orientação
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

// 2. Modal Novo Feedback
export const ModalNovoFeedback: React.FC<{
  matriculaId: string;
  alunoNome: string;
  onClose: () => void;
}> = ({ matriculaId, alunoNome, onClose }) => {
  const { addFeedback } = useSupervisao();
  const [texto, setTexto] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    addFeedback(matriculaId, texto.trim());
    onClose();
  };

  return (
    <ModalWrapper title="Registrar Feedback" subtitle={`Aluno(a): ${alunoNome}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">
            Feedback Formativo ao Aluno
          </label>
          <textarea
            required
            rows={4}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Registre apontamentos sobre desempenho, postura acadêmica, maturidade no estágio..."
            className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
          >
            Salvar Feedback
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

// 3. Modal Registrar Ocorrência
export const ModalRegistrarOcorrencia: React.FC<{
  matriculaId: string;
  alunoNome: string;
  tipoInicial?: 'ATRASO' | 'USO_INADEQUADO_DISPOSITIVO' | 'OUTRO';
  onClose: () => void;
}> = ({ matriculaId, alunoNome, tipoInicial = 'ATRASO', onClose }) => {
  const { addOcorrencia } = useSupervisao();
  const [tipo, setTipo] = useState<'ATRASO' | 'USO_INADEQUADO_DISPOSITIVO' | 'OUTRO'>(tipoInicial);
  const [observacao, setObservacao] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!observacao.trim()) return;
    addOcorrencia(matriculaId, tipo, observacao.trim());
    onClose();
  };

  return (
    <ModalWrapper
      title={tipo === 'ATRASO' ? 'Registrar Atraso' : 'Registrar Ocorrência'}
      subtitle={`Aluno(a): ${alunoNome}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Tipo de Ocorrência</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setTipo('ATRASO')}
              className={`py-2 px-2 rounded-lg border text-center font-medium transition-colors ${
                tipo === 'ATRASO'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              Atraso
            </button>
            <button
              type="button"
              onClick={() => setTipo('USO_INADEQUADO_DISPOSITIVO')}
              className={`py-2 px-2 rounded-lg border text-center font-medium transition-colors ${
                tipo === 'USO_INADEQUADO_DISPOSITIVO'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              Dispositivo
            </button>
            <button
              type="button"
              onClick={() => setTipo('OUTRO')}
              className={`py-2 px-2 rounded-lg border text-center font-medium transition-colors ${
                tipo === 'OUTRO'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              Outro
            </button>
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Detalhes / Observação</label>
          <textarea
            required
            rows={3}
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder={
              tipo === 'ATRASO'
                ? 'Ex: Chegou 20 minutos após o início da supervisão...'
                : tipo === 'USO_INADEQUADO_DISPOSITIVO'
                ? 'Ex: Utilizando redes sociais no tablet durante a discussão de caso...'
                : 'Descreva a ocorrência...'
            }
            className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
          >
            Salvar Ocorrência
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

// 4. Modal Novo Ponto de Acompanhamento (Exclusivamente Acadêmico)
export const ModalNovoPontoAcompanhamento: React.FC<{
  matriculaId: string;
  alunoNome: string;
  onClose: () => void;
}> = ({ matriculaId, alunoNome, onClose }) => {
  const { addPontoAcompanhamento } = useSupervisao();
  const [texto, setTexto] = useState('');
  const [prioridade, setPrioridade] = useState<'ALTA' | 'MEDIA' | 'BAIXA' | ''>('ALTA');

  const sugestoes = [
    'Melhorar objetividade dos registros semanais',
    'Revisar formulação do caso clínico',
    'Acompanhar manejo do contrato terapêutico',
    'Melhorar participação nas supervisões coletivas',
    'Revisar documentação e prazos de entrega',
    'Acompanhar cumprimento das orientações anteriores',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    addPontoAcompanhamento(matriculaId, texto.trim(), prioridade);
    onClose();
  };

  return (
    <ModalWrapper
      title="Novo Ponto de Acompanhamento"
      subtitle={`Aluno(a): ${alunoNome} (Acompanhamento formativo/acadêmico)`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">
            Ponto a ser Acompanhado
          </label>
          <input
            type="text"
            required
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Ex: Revisar fundamentação teórica nos registros..."
            className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        {/* Sugestões acadêmicas rápidas */}
        <div>
          <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">
            Sugestões rápidas:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sugestoes.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setTexto(sug)}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition-colors text-left"
              >
                + {sug}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Prioridade</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPrioridade('ALTA')}
              className={`py-2 px-2 rounded-lg border text-center font-medium transition-colors ${
                prioridade === 'ALTA'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              Alta
            </button>
            <button
              type="button"
              onClick={() => setPrioridade('MEDIA')}
              className={`py-2 px-2 rounded-lg border text-center font-medium transition-colors ${
                prioridade === 'MEDIA'
                  ? 'border-slate-400 bg-slate-100 text-slate-800 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              Média
            </button>
            <button
              type="button"
              onClick={() => setPrioridade('BAIXA')}
              className={`py-2 px-2 rounded-lg border text-center font-medium transition-colors ${
                prioridade === 'BAIXA'
                  ? 'border-slate-400 bg-slate-100 text-slate-800 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              Baixa
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
          >
            Adicionar Ponto
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};
