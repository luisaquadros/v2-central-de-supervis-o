import { useState } from 'react';
import { useSupervisao } from '../../context/SupervisaoContext';
import { evidenciaParaLinha, linhaParaEvidencia, type EvidenciaAvaliacao, type PolaridadeEvidencia } from '../../services/estruturaAvaliacao';
import { mensagemErroAvaliacao } from './useDadosAvaliacao';

const TIPOS: Record<PolaridadeEvidencia, string> = { POSITIVO: 'Ponto forte', DESENVOLVER: 'Lacuna observada', NEUTRO: 'Pendência ou sugestão' };

/** Contribuição qualitativa PRELIMINAR da monitora. Não vê nem altera notas; a professora decide se usa. Regras também no servidor. */
export default function ContribuicaoMonitora({ matriculaId, turmaId, periodoId, email }: { matriculaId: string; turmaId: string; periodoId: string; email: string }) {
  const { evidenciasAvaliacao, salvarLinhaAvaliacao } = useSupervisao();
  const [tipo, setTipo] = useState<PolaridadeEvidencia>('POSITIVO');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const minhas = evidenciasAvaliacao.map(linhaParaEvidencia).filter(e => e.matricula_id === matriculaId && e.origem === 'CONTRIBUICAO_MONITORA' && e.responsavel.toLowerCase() === email.toLowerCase());
  const enviar = async () => {
    setErro('');
    if (!texto.trim() || texto.length > 600) { setErro('Escreva de 1 a 600 caracteres, de forma objetiva.'); return; }
    const agora = new Date().toISOString();
    const ev: EvidenciaAvaliacao = { evidencia_id: `EV-${crypto.randomUUID()}`, periodo_id: periodoId, turma_id: turmaId, matricula_id: matriculaId, data: agora.slice(0, 10),
      origem: 'CONTRIBUICAO_MONITORA', polaridade: tipo, observacao: texto.trim(), responsavel: email.toLowerCase(), preliminar: true, criado_em: agora, atualizado_em: agora };
    try { await salvarLinhaAvaliacao('evidencias_avaliacao', evidenciaParaLinha(ev)); setTexto(''); } catch (e) { setErro(mensagemErroAvaliacao(e)); }
  };
  return (
    <section aria-label="Contribuição da monitora" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-bold text-slate-900">Contribuição para a avaliação (preliminar)</h3>
      <p className="text-xs text-slate-500">Registre pontos fortes, lacunas ou pendências documentais, de forma objetiva. Não inclua conteúdo clínico. A professora decide se usa.</p>
      <label className="block text-xs text-slate-600">Tipo
        <select value={tipo} onChange={e => setTipo(e.target.value as PolaridadeEvidencia)} className="mt-1 w-full min-h-[44px]! rounded-lg border border-slate-300 px-3 text-sm">
          {(Object.keys(TIPOS) as PolaridadeEvidencia[]).map(t => <option key={t} value={t}>{TIPOS[t]}</option>)}
        </select>
      </label>
      <textarea aria-label="Contribuição" value={texto} onChange={e => setTexto(e.target.value)} rows={3} maxLength={600} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      <button onClick={enviar} className="min-h-[44px]! rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white">Enviar contribuição</button>
      {minhas.length > 0 && <ul className="space-y-1 text-xs text-slate-700">{minhas.map(e => <li key={e.evidencia_id} className="rounded-lg bg-slate-50 p-2">{e.observacao} <span className="text-slate-400">· {e.preliminar ? 'preliminar' : 'aproveitada'}</span></li>)}</ul>}
    </section>
  );
}
