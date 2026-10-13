import React, { useMemo, useState } from 'react';
import { Copy, ExternalLink, Send, Wand2 } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { normalizarNota, formatarNotaParaExibicao } from '../utils/gradeUtils';
import type { AvaliacaoCompleta } from '../types';
import { Botao, CLASSE_INPUT, Campo, Janela, Selo } from './ui';

export const INSTRUMENTO_DEVOLUTIVA = 'DEVOLUTIVA_FINAL';

const ROTULO_STATUS: Record<string, { t: string; c: 'cinza' | 'ambar' | 'azul' | 'verde' }> = {
  RASCUNHO: { t: 'rascunho', c: 'ambar' },
  FEEDBACK_PREPARADO: { t: 'texto pronto', c: 'azul' },
  APROVADO_ENVIO: { t: 'aprovada', c: 'azul' },
  ENVIADO: { t: 'enviada', c: 'verde' },
};

export const SeloDevolutiva: React.FC<{ status?: string }> = ({ status }) => {
  const s = status ? ROTULO_STATUS[status] : null;
  return s ? <Selo cor={s.c}>{s.t}</Selo> : <Selo>não iniciada</Selo>;
};

/**
 * Devolutiva do semestre: junta notas, feedbacks registrados ao longo das aulas e o texto da professora.
 * O envio é feito pelo Gmail da própria professora (nada é enviado sem ela ver).
 */
export const DevolutivaModal: React.FC<{ matriculaId: string; aoFechar: () => void }> = ({ matriculaId, aoFechar }) => {
  const {
    getResumoAlunoSupervisao, getCriteriosDaTurma, avaliacoes, avaliacoesCompletas, feedbacks, periodoAtual, currentUser,
    salvarAvaliacaoCompleta, aprovarDevolutiva, registrarEnvioDevolutiva,
  } = useSupervisao();
  const r = getResumoAlunoSupervisao(matriculaId);
  const existente = avaliacoesCompletas.find(a => a.matricula_id === matriculaId && a.instrumento_id === INSTRUMENTO_DEVOLUTIVA);
  const [fortes, setFortes] = useState(existente?.pontos_fortes || '');
  const [desenvolver, setDesenvolver] = useState(existente?.pontos_desenvolver || '');
  const [comentario, setComentario] = useState(existente?.comentario_geral || '');
  const [texto, setTexto] = useState(existente?.feedback_gerado || '');
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const criterios = r ? getCriteriosDaTurma(r.turma.turma_id) : [];
  const notas = useMemo(() => criterios.map(c => {
    const n = normalizarNota(avaliacoes.find(a => a.matricula_id === matriculaId && a.criterio_id === c.criterio_id)?.nota);
    return { criterio_id: c.criterio_id, criterio_nome: c.nome, nota: typeof n === 'number' ? n : 0, lancada: typeof n === 'number', nota_maxima: Number(String(c.nota_maxima).replace(',', '.')) || 0 };
  }), [criterios, avaliacoes, matriculaId]);
  const total = notas.reduce((s, n) => s + n.nota, 0);
  const maximo = notas.reduce((s, n) => s + n.nota_maxima, 0);
  const feedbacksAluno = feedbacks.filter(f => f.matricula_id === matriculaId);

  if (!r) return null;
  const primeiroNome = r.aluno.nome.split(' ')[0];

  const gerarTexto = () => {
    const linhas = [
      `Olá, ${primeiroNome}!`,
      '',
      `Segue a devolutiva do estágio ${r.turma.nome}${periodoAtual ? ` (${periodoAtual.nome})` : ''}.`,
      '',
      `Nota: ${formatarNotaParaExibicao(total)}${maximo ? ` de ${formatarNotaParaExibicao(maximo)}` : ''}`,
      ...notas.filter(n => n.lancada).map(n => `• ${n.criterio_nome}: ${formatarNotaParaExibicao(n.nota)}${n.nota_maxima ? `/${formatarNotaParaExibicao(n.nota_maxima)}` : ''}`),
    ];
    if (fortes.trim()) linhas.push('', 'Pontos fortes:', fortes.trim());
    if (desenvolver.trim()) linhas.push('', 'Para desenvolver:', desenvolver.trim());
    if (comentario.trim()) linhas.push('', comentario.trim());
    linhas.push('', 'Um abraço,', currentUser?.displayName || '');
    setTexto(linhas.join('\n').trim());
  };

  const salvar = async (status: AvaliacaoCompleta['status']) => {
    setSalvando(true);
    try {
      await salvarAvaliacaoCompleta({
        avaliacao_id: existente?.avaliacao_id,
        matricula_id: matriculaId,
        turma_id: r.turma.turma_id,
        instrumento_id: INSTRUMENTO_DEVOLUTIVA,
        tipo_instrumento: 'RUBRICA',
        nota_final: total,
        nota_maxima: maximo || 10,
        status,
        notas_criterios: notas.map(({ lancada: _l, ...n }) => n),
        pontos_fortes: fortes,
        pontos_desenvolver: desenvolver,
        comentario_geral: comentario,
        feedback_gerado: texto,
        data_avaliacao: existente?.data_avaliacao || new Date().toISOString().slice(0, 10),
      });
    } finally {
      setSalvando(false);
    }
  };

  const assunto = `Devolutiva do estágio — ${r.turma.nome}`;
  const linkGmail = r.aluno.email
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(r.aluno.email)}&su=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`
    : '';

  return (
    <Janela titulo={`Devolutiva · ${r.aluno.nome}`} subtitulo={<>Situação: <SeloDevolutiva status={existente?.status} /></>} aoFechar={aoFechar} largura="lg"
      rodape={<>
        <Botao onClick={() => void salvar(texto ? 'FEEDBACK_PREPARADO' : 'RASCUNHO')} disabled={salvando}>Salvar rascunho</Botao>
        {existente && existente.status !== 'ENVIADO' && texto && (
          <Botao variante="secundario" onClick={async () => { await salvar('FEEDBACK_PREPARADO'); await aprovarDevolutiva(existente.avaliacao_id); }}>Aprovar</Botao>
        )}
        {existente && existente.status !== 'ENVIADO' && (
          <Botao variante="sucesso" onClick={() => void registrarEnvioDevolutiva(existente.avaliacao_id)}>Marcar como enviada</Botao>
        )}
      </>}>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="font-semibold text-slate-900">Nota: {formatarNotaParaExibicao(total)}{maximo > 0 && ` de ${formatarNotaParaExibicao(maximo)}`}</p>
          <p className="text-sm text-slate-600">{notas.filter(n => !n.lancada).length > 0 ? `${notas.filter(n => !n.lancada).length} critério(s) sem nota lançada.` : 'Todas as notas lançadas.'}</p>
        </div>
        {feedbacksAluno.length > 0 && (
          <details className="bg-slate-50 rounded-xl p-3">
            <summary className="font-semibold text-slate-800 cursor-pointer">Feedbacks registrados no semestre ({feedbacksAluno.length})</summary>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">{feedbacksAluno.map(f => <li key={f.feedback_id}>• {f.texto}</li>)}</ul>
          </details>
        )}
        <Campo rotulo="Pontos fortes"><textarea className={`${CLASSE_INPUT} h-20`} value={fortes} onChange={e => setFortes(e.target.value)} /></Campo>
        <Campo rotulo="Para desenvolver"><textarea className={`${CLASSE_INPUT} h-20`} value={desenvolver} onChange={e => setDesenvolver(e.target.value)} /></Campo>
        <Campo rotulo="Comentário final (opcional)"><textarea className={`${CLASSE_INPUT} h-16`} value={comentario} onChange={e => setComentario(e.target.value)} /></Campo>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-slate-700">Texto para o estudante</span>
            <Botao tamanho="sm" variante="fantasma" icone={<Wand2 className="w-4 h-4" />} onClick={gerarTexto}>Montar a partir dos campos</Botao>
          </div>
          <textarea className={`${CLASSE_INPUT} h-48 font-mono text-sm`} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Toque em “Montar a partir dos campos” e ajuste o que quiser." />
        </div>
        <div className="flex flex-wrap gap-2">
          {linkGmail ? (
            <a href={linkGmail} target="_blank" rel="noreferrer" onClick={() => void salvar(existente?.status === 'APROVADO_ENVIO' ? 'APROVADO_ENVIO' : 'FEEDBACK_PREPARADO')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 min-h-10 text-sm font-semibold ${texto ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500 pointer-events-none'}`}>
              <Send className="w-4 h-4" /> Abrir no Gmail <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : <p className="text-sm text-amber-800">Sem e-mail cadastrado na aba alunos. Use “Copiar texto”.</p>}
          <Botao icone={<Copy className="w-4 h-4" />} disabled={!texto} onClick={async () => { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}>
            {copiado ? 'Copiado ✓' : 'Copiar texto'}
          </Botao>
        </div>
        <p className="text-sm text-slate-500">O Gmail abre com a mensagem pronta para você revisar e enviar. Depois, toque em “Marcar como enviada”.</p>
      </div>
    </Janela>
  );
};
