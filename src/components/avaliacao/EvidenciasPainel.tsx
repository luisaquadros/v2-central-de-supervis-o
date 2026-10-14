import { mensagemErroAvaliacao } from './useDadosAvaliacao';
import { useState } from 'react';
import { useSupervisao } from '../../context/SupervisaoContext';
import { evidenciaParaLinha, ORIGENS_EVIDENCIA, type EvidenciaAvaliacao, type OrigemEvidencia, type PolaridadeEvidencia } from '../../services/estruturaAvaliacao';
import type { CriterioAvaliacao } from '../../types';

const ROTULO_ORIGEM: Record<OrigemEvidencia, string> = {
  SUPERVISAO: 'Supervisão', ENTREGA_DOCUMENTAL: 'Entrega documental', ATIVIDADE_AVALIATIVA: 'Atividade avaliativa',
  OBSERVACAO_PROFESSORA: 'Observação da professora', CONTRIBUICAO_MONITORA: 'Contribuição da monitora',
};
const ROTULO_POLARIDADE: Record<PolaridadeEvidencia, string> = { POSITIVO: 'Ponto forte', DESENVOLVER: 'A desenvolver', NEUTRO: 'Registro' };
const COR_POLARIDADE: Record<PolaridadeEvidencia, string> = { POSITIVO: 'bg-emerald-50 text-emerald-800 border-emerald-200', DESENVOLVER: 'bg-amber-50 text-amber-800 border-amber-200', NEUTRO: 'bg-slate-50 text-slate-700 border-slate-200' };
const dataBr = (iso: string) => /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso;

interface Props {
  evidencias: EvidenciaAvaliacao[];
  matriculaId: string;
  turmaId: string;
  periodoId: string;
  criterios: CriterioAvaliacao[];
  emailProfessora: string;
}

/** Linha do tempo de evidências do semestre. Registro curto e objetivo; prefira referência a registro existente a copiar conteúdo clínico. */
export default function EvidenciasPainel({ evidencias, matriculaId, turmaId, periodoId, criterios, emailProfessora }: Props) {
  const { salvarLinhaAvaliacao } = useSupervisao();
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [origem, setOrigem] = useState<OrigemEvidencia>('SUPERVISAO');
  const [polaridade, setPolaridade] = useState<PolaridadeEvidencia>('POSITIVO');
  const [criterioId, setCriterioId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [referencia, setReferencia] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const doAluno = evidencias.filter(e => e.matricula_id === matriculaId).sort((a, b) => b.data.localeCompare(a.data));

  const salvar = async () => {
    setErro('');
    if (!observacao.trim()) { setErro('Escreva uma observação objetiva.'); return; }
    if (observacao.length > 600) { setErro('Use até 600 caracteres; para detalhes, indique a referência do registro de origem.'); return; }
    setSalvando(true);
    try {
      const agora = new Date().toISOString();
      const ev: EvidenciaAvaliacao = {
        evidencia_id: `EV-${crypto.randomUUID()}`, periodo_id: periodoId, turma_id: turmaId, matricula_id: matriculaId, data, origem,
        criterio_id: criterioId || undefined, polaridade, observacao: observacao.trim(), responsavel: emailProfessora,
        referencia_id: referencia.trim() || undefined, preliminar: false, criado_em: agora, atualizado_em: agora,
      };
      await salvarLinhaAvaliacao('evidencias_avaliacao', evidenciaParaLinha(ev));
      setObservacao(''); setReferencia('');
    } catch (e) { setErro(mensagemErroAvaliacao(e)); }
    finally { setSalvando(false); }
  };

  const aproveitar = async (e: EvidenciaAvaliacao) => {
    setErro('');
    try { await salvarLinhaAvaliacao('evidencias_avaliacao', evidenciaParaLinha({ ...e, preliminar: false, atualizado_em: new Date().toISOString() })); }
    catch (x) { setErro(mensagemErroAvaliacao(x)); }
  };

  return (
    <div className="space-y-4" aria-label="Evidências">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-900">Registrar evidência</h4>
        <p className="text-xs text-slate-500">Observação curta e objetiva. Não copie conteúdo clínico: indique o registro de origem.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-600">Data
            <input type="date" value={data} onChange={e => setData(e.target.value)} className="mt-1 w-full min-h-[44px]! rounded-lg border border-slate-300 px-3 text-sm" />
          </label>
          <label className="text-xs text-slate-600">Origem
            <select value={origem} onChange={e => setOrigem(e.target.value as OrigemEvidencia)} className="mt-1 w-full min-h-[44px]! rounded-lg border border-slate-300 px-3 text-sm">
              {ORIGENS_EVIDENCIA.filter(o => o !== 'CONTRIBUICAO_MONITORA').map(o => <option key={o} value={o}>{ROTULO_ORIGEM[o]}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">Tipo
            <select value={polaridade} onChange={e => setPolaridade(e.target.value as PolaridadeEvidencia)} className="mt-1 w-full min-h-[44px]! rounded-lg border border-slate-300 px-3 text-sm">
              {(Object.keys(ROTULO_POLARIDADE) as PolaridadeEvidencia[]).map(p => <option key={p} value={p}>{ROTULO_POLARIDADE[p]}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">Critério (opcional)
            <select value={criterioId} onChange={e => setCriterioId(e.target.value)} className="mt-1 w-full min-h-[44px]! rounded-lg border border-slate-300 px-3 text-sm">
              <option value="">Sem critério</option>
              {criterios.map(c => <option key={c.criterio_id} value={c.criterio_id}>{c.nome}</option>)}
            </select>
          </label>
        </div>
        <label className="text-xs text-slate-600 block">Observação objetiva
          <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={3} maxLength={600} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <span className="text-[11px] text-slate-400">{observacao.length}/600</span>
        </label>
        <label className="text-xs text-slate-600 block">Referência do registro de origem (opcional)
          <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="ex.: identificador do registro de supervisão" className="mt-1 w-full min-h-[44px]! rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
        <button onClick={salvar} disabled={salvando} className="min-h-[44px]! w-full sm:w-auto rounded-lg cs-primary-action px-4 text-sm font-semibold text-white disabled:opacity-50">
          {salvando ? 'Salvando…' : 'Salvar evidência'}
        </button>
      </div>

      <ol className="space-y-2">
        {doAluno.length === 0 && <li className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500">Nenhuma evidência registrada neste semestre. Não é preciso registrar a cada aula.</li>}
        {doAluno.map(e => (
          <li key={e.evidencia_id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-mono text-slate-500">{dataBr(e.data)}</span>
              <span className={`rounded-full border px-2 py-0.5 ${COR_POLARIDADE[e.polaridade]}`}>{ROTULO_POLARIDADE[e.polaridade]}</span>
              <span className="text-slate-500">{ROTULO_ORIGEM[e.origem]}</span>
              {e.preliminar && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-800">Preliminar (não confirmada)</span>}
            </div>
            <p className="text-sm text-slate-800">{e.observacao}</p>
            {e.referencia_id && <p className="text-[11px] text-slate-500">Referência: {e.referencia_id}</p>}
            {e.preliminar && (
              <button onClick={() => aproveitar(e)} className="min-h-[44px]! rounded-lg border border-indigo-300 px-3 text-xs font-semibold text-indigo-800">
                Aproveitar na avaliação
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
