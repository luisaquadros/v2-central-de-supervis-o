import { useMemo, useState } from 'react';
import { useSupervisao } from '../../context/SupervisaoContext';
import { FeedbackModal } from '../FeedbackModal';
import type { Aluno, Avaliacao, AvaliacaoCompleta, CriterioAvaliacao, Documento, Ocorrencia, Turma } from '../../types';
import { gerarRascunhoDevolutiva, type PendenciaDocumento } from '../../services/devolutivaAvaliacao';
import { resumirNotasMatricula } from '../../services/avaliacaoResumo';
import { configPorCriterioDoAluno, type ConfigAvaliacao, type EvidenciaAvaliacao } from '../../services/estruturaAvaliacao';
import type { RascunhoAvaliacao, RubricaVersao } from '../../services/rubricasAvaliacao';

interface Props {
  aluno: Aluno; turma: Turma; matriculaId: string; periodoId: string;
  criterios: CriterioAvaliacao[]; avaliacoes: Avaliacao[]; ocorrencias: Ocorrencia[]; documentos: Documento[];
  configs: ConfigAvaliacao[]; rubricas: RubricaVersao[]; rascunhos: RascunhoAvaliacao[]; evidencias: EvidenciaAvaliacao[];
}

/** Rascunho EDITÁVEL gerado por regras. Nada é enviado nem publicado daqui: a aprovação e o envio ficam no modal de revisão. */
export default function DevolutivaPainel(p: Props) {
  const { getSituacaoRssEstudante, avaliacoesCompletas } = useSupervisao();
  const [texto, setTexto] = useState('');
  const [gerado, setGerado] = useState<ReturnType<typeof gerarRascunhoDevolutiva> | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const montar = () => {
    const ids = p.criterios.map(c => c.criterio_id);
    const configPorCriterio = configPorCriterioDoAluno({ configs: p.configs, rubricas: p.rubricas, rascunhos: p.rascunhos, turmaId: p.turma.turma_id, periodoId: p.periodoId, criterioIds: ids, matriculaId: p.matriculaId });
    const resumo = resumirNotasMatricula({ criterios: p.criterios, avaliacoes: p.avaliacoes, matriculaId: null, turmaId: p.turma.turma_id, disciplinaId: p.turma.disciplina_id, ocorrencias: p.ocorrencias, configPorCriterio });
    const rascunho = p.rascunhos.filter(r => r.matricula_id === p.matriculaId && r.escopo === 'INDIVIDUAL').sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))[0] ?? null;
    const rubrica = rascunho ? p.rubricas.find(r => r.rubrica_id === rascunho.rubrica_id && r.versao === rascunho.rubrica_versao) ?? null : null;
    const rss = getSituacaoRssEstudante(p.matriculaId);
    const documentos: PendenciaDocumento[] = [];
    for (const d of p.documentos) {
      if (d.matricula_id !== p.matriculaId) continue;
      if (d.status === 'PENDENTE') documentos.push({ nome: d.tipo, situacao: 'PENDENTE' });
      else if (d.status === 'EM_ANALISE') documentos.push({ nome: d.tipo, situacao: 'A_CONFERIR' });
    }
    return gerarRascunhoDevolutiva({
      resultado: resumo.resultado, rubrica, rascunho, evidencias: p.evidencias.filter(e => e.matricula_id === p.matriculaId),
      rss: rss ? { realizados: rss.registrosRealizados, esperadosAteOPrazo: rss.registrosEsperadosAteHoje, totalPrevisto: rss.totalPrevistoNoPeriodo } : null,
      documentos, temRegistroParticipacao: p.evidencias.some(e => e.matricula_id === p.matriculaId && e.origem === 'SUPERVISAO'), geradoEm: new Date().toISOString(),
    });
  };
  const gerar = () => {
    if (texto.trim() && gerado && texto !== gerado.texto && !window.confirm('Substituir o texto editado por um novo rascunho?')) return;
    const g = montar(); setGerado(g); setTexto(g.texto);
  };
  const resumoAtual = useMemo(() => resumirNotasMatricula({ criterios: p.criterios, avaliacoes: p.avaliacoes, matriculaId: null, turmaId: p.turma.turma_id, disciplinaId: p.turma.disciplina_id }), [p.criterios, p.avaliacoes, p.turma]);
  const existente = (avaliacoesCompletas as AvaliacaoCompleta[]).find(a => a.matricula_id === p.matriculaId);
  const paraRevisao: AvaliacaoCompleta = {
    ...(existente ?? { avaliacao_id: `devolutiva-${p.matriculaId}`, matricula_id: p.matriculaId, aluno_id: p.aluno.aluno_id, turma_id: p.turma.turma_id, instrumento_id: 'Avaliação do estágio',
      tipo_instrumento: 'RUBRICA', nota_final: resumoAtual.totalOficial, nota_maxima: resumoAtual.totalMaximo, status: 'RASCUNHO', atualizado_em: new Date().toISOString() }),
    feedback_gerado: texto,
  } as AvaliacaoCompleta;

  return (
    <div className="space-y-4" aria-label="Devolutiva">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <p className="text-sm text-slate-800">O rascunho é montado por regras a partir da rubrica, das evidências, das notas oficiais e das pendências. <strong>Não usa IA e nunca é enviado sozinho.</strong></p>
        <button onClick={gerar} className="min-h-[44px]! w-full sm:w-auto rounded-lg cs-primary-action px-4 text-sm font-semibold text-white">{gerado ? 'Gerar novamente' : 'Gerar rascunho'}</button>
      </div>

      {gerado && (
        <>
          {gerado.complementar.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3" role="status">
              <p className="text-sm font-semibold text-amber-900">Para complementar antes de finalizar ({gerado.complementar.length})</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-900 space-y-0.5">{gerado.complementar.map(c => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <label className="block text-xs text-slate-600">Texto da devolutiva (editável)
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={16} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">De onde veio cada frase</summary>
            <div className="mt-2 space-y-2">{gerado.secoes.map(s => s.itens.length > 0 && (
              <div key={s.id}><p className="font-semibold">{s.titulo}</p><ul className="list-disc pl-5">{s.itens.map((i, k) => <li key={k}>{i.texto.slice(0, 80)}{i.texto.length > 80 ? '…' : ''} <span className="text-slate-400">— {i.fontes.join('; ')}</span></li>)}</ul></div>
            ))}</div>
          </details>
          <div className="flex flex-wrap gap-2">
            <button onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { setCopiado(false); } }} className="min-h-[44px]! rounded-lg border border-slate-400 px-4 text-sm font-semibold">{copiado ? 'Copiado' : 'Copiar texto'}</button>
            <button onClick={() => setRevisando(true)} disabled={!texto.trim()} className="min-h-[44px]! rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-40">Revisar e aprovar</button>
          </div>
          <p className="text-xs text-slate-500">A aprovação e o envio acontecem na tela de revisão, por ação explícita sua.</p>
        </>
      )}
      {revisando && <FeedbackModal isOpen onClose={() => setRevisando(false)} avaliacao={paraRevisao} aluno={p.aluno} turma={p.turma} />}
    </div>
  );
}
