import { useState, useRef } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import type { SituacaoRssEstudante } from '../types';
import { ajusteParaLinha, linhaParaAjuste } from '../services/estruturaAvaliacao';
import type { AjusteRss } from '../services/rssEntregas';
import { mensagemErroAvaliacao } from './avaliacao/useDadosAvaliacao';

const lista = (n: number[]) => (n.length ? n.join(', ') : '—');
const dataBr = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

interface Props {
  situacao: SituacaoRssEstudante | null;
  turmaId: string;
  /** unidade de entrega: o grupo (Clínica Ampliada) ou a matrícula */
  unidade: { tipo: 'MATRICULA' | 'GRUPO'; id: string; nome?: string };
  /** monitora: só o status administrativo, sem observações nem correções */
  compacto?: boolean;
  email?: string;
}

/**
 * Controle simples e automático das entregas de RSS: ENTREGUE / NÃO ENTREGUE por semana, totais e atraso discreto.
 * Nada aqui pede confirmação por registro, pontua ou desconta nota. Não exibe conteúdo clínico.
 */
export default function EntregasRssPainel({ situacao, turmaId, unidade, compacto, email = '' }: Props) {
  const { rssAjustes, salvarLinhaAvaliacao } = useSupervisao();
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const gravando = useRef(false);
  const [obsSemana, setObsSemana] = useState<number | null>(null);
  const [obsTexto, setObsTexto] = useState('');
  const [semanaPara, setSemanaPara] = useState<Record<string, string>>({});
  const e = situacao?.entregas;
  if (!situacao || !e) return <p role="status" className="prisma-meta">RSS não verificado. Consulte o cronograma e a sincronização.</p>;

  const ajustes: AjusteRss[] = rssAjustes.map(linhaParaAjuste);
  const ativos = ajustes.filter(a => a.tipo === 'ASSOCIAR' && a.status === 'ATIVO' && a.registro_id && situacao.registrosEstudante.some(r => String(r.registro_id) === a.registro_id));
  const grava = async (a: AjusteRss): Promise<boolean> => {
    if (gravando.current) return false;
    gravando.current = true;setOcupado(true);setErro('');
    try { await salvarLinhaAvaliacao('rss_ajustes', ajusteParaLinha(a)); return true; }
    catch (x) { setErro(mensagemErroAvaliacao(x)); return false; }
    finally { gravando.current = false;setOcupado(false); }
  };
  const agora = () => new Date().toISOString();

  const associar = async (registroId: string, semana: number) => {
    const reg = situacao.registrosEstudante.find(r => String(r.registro_id) === registroId) as unknown as Record<string, unknown> | undefined;
    const original = Number(String(reg?.semana_rss ?? '').trim());
    await grava({ ajuste_id: `AJ-${crypto.randomUUID()}`, tipo: 'ASSOCIAR', registro_id: registroId, turma_id: turmaId, semana,
      semana_original: Number.isInteger(original) && original > 0 ? original : null, status: 'ATIVO', criado_em: agora(), criado_por: email });
  };
  const desfazer = (a: AjusteRss) => grava({ ...a, status: 'REVOGADO', atualizado_em: agora() });
  const salvarObs = async () => {
    if (!obsSemana || !obsTexto.trim()) return;
    const salvo = await grava({ ajuste_id: `AJ-${crypto.randomUUID()}`, tipo: 'OBSERVACAO', turma_id: turmaId, unidade_tipo: unidade.tipo, unidade_id: unidade.id, semana: obsSemana,
      observacao: obsTexto.trim().slice(0, 300), status: 'ATIVO', criado_em: agora(), criado_por: email });
    if (salvo) setObsSemana(null); setObsTexto('');
  };

  const pend = e.semanasPendentes;
  return (
    <section aria-label="Entregas de RSS" data-testid="entregas-rss" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-900">Entregas de RSS{unidade.tipo === 'GRUPO' ? ` — ${unidade.nome || 'grupo'} (entrega coletiva)` : ''}</h4>
        <p className="text-sm text-slate-800"><strong>{e.totalRealizado}</strong> realizadas de <strong>{e.totalPrevisto}</strong> previstas no semestre <span className="text-slate-500">· {e.esperadosAteHoje} esperadas até hoje</span></p>
      </div>

      {e.disponibilidade !== 'OK' ? (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs text-slate-700">Não foi possível ler os RSS agora (sincronização incompleta). Nenhuma semana foi marcada como não entregue.</p>
      ) : (
        <p className="text-xs text-slate-700">
          <span className="font-semibold text-emerald-800">Semanas entregues:</span> {lista(e.semanasEntregues)}
          {' · '}
          <span className="font-semibold text-red-800">Semanas pendentes:</span> {pend ? lista(pend) : e.pendentesEmNumero > 0 ? `${e.pendentesEmNumero} entrega(s) a identificar` : '—'}
        </p>
      )}
      {(e.semSemanaIdentificada.length > 0 || e.consolidadoSemDetalhe > 0) && e.disponibilidade === 'OK' && (
        <p className="text-xs text-slate-600">{e.semSemanaIdentificada.length + e.consolidadoSemDetalhe} entrega(s) sem semana identificada, já contadas no total. Enquanto não houver semana, nenhuma semana é marcada como não entregue.</p>
      )}
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {e.semanas.map(s => (
          <li key={s.semana} className={`rounded-xl border p-2.5 text-xs ${s.status === 'ENTREGUE' ? 'border-emerald-200 bg-emerald-50/50' : s.status === 'NAO_ENTREGUE' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between"><span className="font-bold text-slate-900">Semana {s.semana}</span>
              {s.status === 'ENTREGUE' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : s.status === 'NAO_ENTREGUE' ? <XCircle className="h-4 w-4 text-red-600" aria-hidden /> : <Clock className="h-4 w-4 text-slate-400" aria-hidden />}
            </div>
            <p className={`mt-1 font-semibold ${s.status === 'ENTREGUE' ? 'text-emerald-800' : s.status === 'NAO_ENTREGUE' ? 'text-red-800' : 'text-slate-400'}`}>
              {s.status === 'ENTREGUE' ? 'Entregue' : s.status === 'NAO_ENTREGUE' ? 'Não entregue' : s.exigivel ? '—' : 'a vencer'}
            </p>
            {s.atrasada && <p className="text-[10px] text-slate-500" title="Entregue depois do fim da semana (informativo)">após a semana{s.dataEntrega ? ` · ${dataBr(s.dataEntrega)}` : ''}</p>}
            {!compacto && s.observacoes.map((o, i) => <p key={i} className="mt-1 text-[11px] text-slate-600">“{o}”</p>)}
            {!compacto && <button type="button" onClick={() => { setObsSemana(s.semana); setObsTexto(''); }} className="mt-1 min-h-[44px]! text-[11px] text-indigo-700 underline">observação</button>}
          </li>
        ))}
      </ol>

      {!compacto && obsSemana !== null && (
        <div className="rounded-xl border border-slate-300 bg-white p-3 space-y-2" role="group" aria-label={`Observação da semana ${obsSemana}`}>
          <label className="block text-xs text-slate-600">Observação da semana {obsSemana} (curta; sem conteúdo clínico)
            <textarea value={obsTexto} onChange={ev => setObsTexto(ev.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="flex gap-2"><button type="button" disabled={ocupado} onClick={salvarObs} className="min-h-[44px]! rounded-lg cs-primary-action px-4 text-sm font-semibold text-white">Salvar observação</button><button type="button" onClick={() => setObsSemana(null)} className="min-h-[44px]! rounded-lg border border-slate-300 px-4 text-sm">Cancelar</button></div>
        </div>
      )}

      {!compacto && (e.semSemanaIdentificada.length > 0 || ativos.length > 0) && (
        <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <summary className="cursor-pointer font-semibold">Corrigir associação (opcional)</summary>
          <div className="mt-2 space-y-2">
            {e.semSemanaIdentificada.map(id => (
              <div key={id} className="flex flex-wrap items-center gap-2"><span>Registro sem semana identificada</span>
                <select aria-label="Semana do registro" value={semanaPara[id] ?? ''} onChange={ev => setSemanaPara(m => ({ ...m, [id]: ev.target.value }))} className="min-h-[44px]! rounded-lg border border-slate-300 px-2">
                  <option value="">Semana…</option>{Array.from({ length: e.totalPrevisto }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" disabled={ocupado || !semanaPara[id]} onClick={() => associar(id, Number(semanaPara[id]))} className="min-h-[44px]! rounded-lg border border-slate-400 px-3 font-semibold disabled:opacity-40">Associar</button>
              </div>
            ))}
            {ativos.map(a => (
              <div key={a.ajuste_id} className="flex flex-wrap items-center gap-2"><span>Correção ativa: registro associado à semana {a.semana} (antes: {a.semana_original ?? 'sem semana'})</span>
                <button type="button" disabled={ocupado} onClick={() => desfazer(a)} className="min-h-[44px]! rounded-lg border border-slate-400 px-3 font-semibold">Desfazer</button></div>
            ))}
            <p className="text-slate-500">Toda correção fica registrada com autoria e pode ser desfeita; os dados originais da planilha não são alterados.</p>
          </div>
        </details>
      )}
    </section>
  );
}
