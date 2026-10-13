import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Mail, MessageSquare, PenLine, Plus, Trash2 } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import {
  aulasDoDia, formatarDataBr, formatarDiaCurto, nomeTipoEntrega, obterSemanaRssValidada, somarDias,
} from '../services/supervisaoOperacionalService';
import { textoComparavel } from '../services/normalizacaoPlanilha';
import { formatarNotaParaExibicao, normalizarNota } from '../utils/gradeUtils';
import type { Frequencia, SituacaoEntrega } from '../types';
import { ModalNovaOrientacao, ModalNovoFeedback, ModalNovoPontoAcompanhamento, ModalRegistrarOcorrencia } from '../components/Modals';
import { Abas, Botao, Cartao, CLASSE_INPUT, Secao, Selo, Vazio } from '../components/ui';

type AbaFicha = 'resumo' | 'historico' | 'frequencia' | 'rss' | 'documentos' | 'notas';

const STATUS_FREQ: { id: Frequencia['status']; rotulo: string; cor: 'verde' | 'vermelho' | 'azul' | 'ambar' }[] = [
  { id: 'PRESENTE', rotulo: 'Presente', cor: 'verde' },
  { id: 'FALTA_SEM_JUSTIFICATIVA', rotulo: 'Falta', cor: 'vermelho' },
  { id: 'FALTA_JUSTIFICADA', rotulo: 'Falta justificada', cor: 'azul' },
  { id: 'JUSTIFICATIVA_PENDENTE', rotulo: 'Justificativa a avaliar', cor: 'ambar' },
];

/** Ficha do estudante: resumo, linha do tempo, frequência, RSS, documentos e notas. */
export const AlunoFichaView: React.FC<{ matriculaId: string; initialTab?: string }> = ({ matriculaId, initialTab }) => {
  const {
    getResumoAlunoSupervisao, getGrupoDoAluno, getOrigemDoAluno, turmasOrigem, setOrigemDoAluno, leiturasResponsaveis,
    getResponsaveisLeitura, togglePontoStatus, toggleOrientacaoStatus,
  } = useSupervisao();
  const { abrirAnotar } = useNavegacao();
  const abaValida = (['resumo', 'historico', 'frequencia', 'rss', 'documentos', 'notas'] as AbaFicha[]).includes(initialTab as AbaFicha);
  const [aba, setAba] = useState<AbaFicha>(abaValida ? (initialTab as AbaFicha) : 'resumo');
  const [modal, setModal] = useState<'orientacao' | 'feedback' | 'ponto' | 'ocorrencia' | null>(null);
  const r = getResumoAlunoSupervisao(matriculaId);
  if (!r) return <Vazio titulo="Estudante não encontrado" />;

  const grupo = getGrupoDoAluno(matriculaId);
  const origem = getOrigemDoAluno(matriculaId);
  const origensTurma = turmasOrigem.filter(o => o.turma_id === r.turma.turma_id && o.ativo);
  const estudos = leiturasResponsaveis.filter(l => l.turma_id === r.turma.turma_id
    && getResponsaveisLeitura(l).some(x => x.matriculaId === matriculaId || textoComparavel(x.nome) === textoComparavel(r.aluno.nome)));

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{r.aluno.nome}</h1>
          <p className="text-slate-600">
            {r.turma.nome}{grupo && <> · {grupo.nome_grupo}</>}
            {(r.matricula as any).papel_na_turma === 'REPRESENTANTE' && <Selo cor="roxo" className="ml-2">representante</Selo>}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
            {r.aluno.email && (
              <a href={`mailto:${r.aluno.email}`} className="inline-flex items-center gap-1 text-slate-700 hover:underline"><Mail className="w-4 h-4" />{r.aluno.email}</a>
            )}
            {origensTurma.length > 1 ? (
              <label className="inline-flex items-center gap-1 text-slate-600">Docente Online:
                <select value={origem?.origem_id || ''} onChange={e => void setOrigemDoAluno(matriculaId, e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                  {origensTurma.map(o => <option key={o.origem_id} value={o.origem_id}>{o.codigo_externo}</option>)}
                </select>
              </label>
            ) : origem && <span className="text-slate-600">Docente Online: {origem.codigo_externo}</span>}
          </div>
        </div>
        <Botao icone={<PenLine className="w-4 h-4" />} onClick={() => abrirAnotar({ matriculaId })}>Anotar</Botao>
      </header>

      <Abas<AbaFicha>
        abas={[
          { id: 'resumo', rotulo: 'Resumo' },
          { id: 'historico', rotulo: 'Linha do tempo' },
          { id: 'frequencia', rotulo: 'Frequência', contador: r.justificativasPendentesCount },
          { id: 'rss', rotulo: 'RSS', contador: r.situacaoRss?.estaAtrasado ? Math.abs(r.situacaoRss.saldoRss) : 0 },
          { id: 'documentos', rotulo: 'Documentos', contador: r.docsPendentesCount },
          { id: 'notas', rotulo: 'Notas' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      {aba === 'resumo' && (
        <div className="space-y-4">
          {r.motivosAtencao.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.motivosAtencao.map(m => <Selo key={m} cor={r.statusAtencao === 'PRIORIDADE' ? 'vermelho' : 'ambar'}>{m}</Selo>)}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Botao variante="primario" icone={<Plus className="w-4 h-4" />} onClick={() => setModal('orientacao')}>Orientação</Botao>
            <Botao icone={<MessageSquare className="w-4 h-4" />} onClick={() => setModal('feedback')}>Feedback</Botao>
            <Botao icone={<Check className="w-4 h-4" />} onClick={() => setModal('ponto')}>Acompanhar</Botao>
            <Botao icone={<AlertTriangle className="w-4 h-4" />} onClick={() => setModal('ocorrencia')}>Ocorrência</Botao>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Secao titulo="Para acompanhar">
              {r.pontosAtivos.length === 0 ? <p className="text-slate-500">Nenhum ponto em aberto.</p> : (
                <ul className="space-y-2">
                  {r.pontosAtivos.map(p => (
                    <li key={p.ponto_id} className="flex items-start gap-3">
                      <button onClick={() => void togglePontoStatus(p.ponto_id)} aria-label="Concluir" className="mt-0.5 w-6 h-6 rounded-md border-2 border-slate-300 hover:border-emerald-500 cursor-pointer shrink-0" />
                      <span className="text-slate-800">{p.texto} {p.prioridade === 'ALTA' && <Selo cor="vermelho">alta</Selo>}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
            <Secao titulo={`Orientações em aberto (${r.orientacoesAbertasCount})`}>
              <OrientacoesAbertas matriculaId={matriculaId} aoAlternar={id => void toggleOrientacaoStatus(id)} />
            </Secao>
          </div>
          {estudos.length > 0 && (
            <Secao titulo="Estudos dirigidos sob responsabilidade">
              <ul className="space-y-1.5">
                {estudos.map(l => (
                  <li key={l.leitura_id} className="text-slate-800">
                    <strong>{formatarDataBr(l.data)}</strong> — {l.tema}
                    {l.status_realizacao && <Selo cor={l.status_realizacao === 'REALIZADO' ? 'verde' : 'ambar'} className="ml-2">{l.status_realizacao.toLowerCase().replace('_', ' ')}</Selo>}
                  </li>
                ))}
              </ul>
            </Secao>
          )}
        </div>
      )}
      {aba === 'historico' && <LinhaDoTempo matriculaId={matriculaId} />}
      {aba === 'frequencia' && <FrequenciaAluno matriculaId={matriculaId} turmaId={r.turma.turma_id} />}
      {aba === 'rss' && <RssAluno matriculaId={matriculaId} />}
      {aba === 'documentos' && <DocumentosAluno matriculaId={matriculaId} />}
      {aba === 'notas' && <NotasAluno matriculaId={matriculaId} turmaId={r.turma.turma_id} />}

      {modal === 'orientacao' && <ModalNovaOrientacao matriculaId={matriculaId} alunoNome={r.aluno.nome} grupo={grupo} onClose={() => setModal(null)} />}
      {modal === 'feedback' && <ModalNovoFeedback matriculaId={matriculaId} alunoNome={r.aluno.nome} onClose={() => setModal(null)} />}
      {modal === 'ponto' && <ModalNovoPontoAcompanhamento matriculaId={matriculaId} alunoNome={r.aluno.nome} onClose={() => setModal(null)} />}
      {modal === 'ocorrencia' && <ModalRegistrarOcorrencia matriculaId={matriculaId} alunoNome={r.aluno.nome} onClose={() => setModal(null)} />}
    </div>
  );
};

const OrientacoesAbertas: React.FC<{ matriculaId: string; aoAlternar: (id: string) => void }> = ({ matriculaId, aoAlternar }) => {
  const { orientacoes } = useSupervisao();
  const abertas = orientacoes.filter(o => o.matricula_id === matriculaId && o.status === 'ABERTA')
    .sort((a, b) => String(b.data_hora).localeCompare(String(a.data_hora)));
  if (abertas.length === 0) return <p className="text-slate-500">Nada para retomar.</p>;
  return (
    <ul className="space-y-3">
      {abertas.map(o => (
        <li key={o.orientacao_id} className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm text-slate-500">{o.categoria} · {formatarDataBr(String(o.data_hora).slice(0, 10))}</p>
            <p className="text-slate-800 whitespace-pre-wrap">{o.texto}</p>
          </div>
          <Botao tamanho="sm" onClick={() => aoAlternar(o.orientacao_id)}>Concluir</Botao>
        </li>
      ))}
    </ul>
  );
};

// ---------------------------------------------------------------------------

type FiltroTempo = 'tudo' | 'orientacoes' | 'feedbacks' | 'ocorrencias' | 'pontos';

const LinhaDoTempo: React.FC<{ matriculaId: string }> = ({ matriculaId }) => {
  const { orientacoes, feedbacks, ocorrencias, pontosAcompanhamento, solicitarExclusao, toggleOrientacaoStatus, togglePontoStatus } = useSupervisao();
  const [filtro, setFiltro] = useState<FiltroTempo>('tudo');

  const eventos = useMemo(() => {
    const lista: { id: string; data: string; dataTexto?: string; tipo: Exclude<FiltroTempo, 'tudo'>; titulo: string; texto: string; acao?: React.ReactNode; excluir?: () => void }[] = [];
    orientacoes.filter(o => o.matricula_id === matriculaId).forEach(o => lista.push({
      id: o.orientacao_id, data: String(o.data_hora), tipo: 'orientacoes', titulo: `Orientação · ${o.categoria}`, texto: o.texto,
      acao: <Botao tamanho="sm" variante="fantasma" onClick={() => void toggleOrientacaoStatus(o.orientacao_id)}>{o.status === 'ABERTA' ? 'Concluir' : 'Reabrir'}</Botao>,
      excluir: () => solicitarExclusao({ nome: 'Orientação', tabela: 'orientacoes', registro: o }),
    }));
    feedbacks.filter(f => f.matricula_id === matriculaId).forEach(f => lista.push({
      id: f.feedback_id, data: String(f.data_hora), dataTexto: f.data_texto, tipo: 'feedbacks', titulo: f.categoria ? `Feedback · ${f.categoria}` : 'Feedback', texto: f.texto || '',
      excluir: () => solicitarExclusao({ nome: 'Feedback', tabela: 'feedbacks', registro: f as any }),
    }));
    ocorrencias.filter(o => o.matricula_id === matriculaId).forEach(o => lista.push({
      id: o.ocorrencia_id, data: String(o.data_hora), dataTexto: o.data_texto, tipo: 'ocorrencias',
      titulo: o.tipo === 'ATRASO' ? 'Atraso' : o.tipo === 'USO_INADEQUADO_DISPOSITIVO' ? 'Uso de celular' : o.tipo === 'OUTRO' || !o.tipo ? 'Ocorrência' : String(o.tipo),
      texto: o.observacao,
      excluir: () => solicitarExclusao({ nome: 'Ocorrência', tabela: 'ocorrencias', registro: o }),
    }));
    pontosAcompanhamento.filter(p => p.matricula_id === matriculaId).forEach(p => lista.push({
      id: p.ponto_id, data: String(p.data_criacao), tipo: 'pontos', titulo: `Ponto de acompanhamento${p.status === 'CONCLUIDO' ? ' (concluído)' : ''}`, texto: p.texto,
      acao: <Botao tamanho="sm" variante="fantasma" onClick={() => void togglePontoStatus(p.ponto_id)}>{p.status === 'ATIVO' ? 'Concluir' : 'Reabrir'}</Botao>,
      excluir: () => solicitarExclusao({ nome: 'Ponto de acompanhamento', tabela: 'pontos_acompanhamento', registro: p }),
    }));
    return lista.sort((a, b) => b.data.localeCompare(a.data));
  }, [matriculaId, orientacoes, feedbacks, ocorrencias, pontosAcompanhamento, solicitarExclusao, toggleOrientacaoStatus, togglePontoStatus]);

  const visiveis = eventos.filter(e => filtro === 'tudo' || e.tipo === filtro);
  const FILTROS: [FiltroTempo, string][] = [['tudo', 'Tudo'], ['orientacoes', 'Orientações'], ['feedbacks', 'Feedbacks'], ['ocorrencias', 'Ocorrências'], ['pontos', 'Acompanhamento']];

  return (
    <Cartao className="p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map(([id, rotulo]) => (
          <button key={id} onClick={() => setFiltro(id)} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${filtro === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'}`}>{rotulo}</button>
        ))}
      </div>
      {visiveis.length === 0 ? <Vazio titulo="Nenhum registro" /> : (
        <ul className="divide-y divide-slate-100">
          {visiveis.map(e => (
            <li key={`${e.tipo}-${e.id}`} className="py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-500">{e.dataTexto || formatarDataBr(e.data.slice(0, 10), true)} · {e.titulo}</p>
                <p className="text-slate-800 whitespace-pre-wrap">{e.texto}</p>
              </div>
              {e.acao}
              {e.excluir && <button onClick={e.excluir} aria-label="Excluir" className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
};

// ---------------------------------------------------------------------------

const FrequenciaAluno: React.FC<{ matriculaId: string; turmaId: string }> = ({ matriculaId, turmaId }) => {
  const { turmas, horariosTurma, encontrosTurma, frequencias, matriculas, periodoAtual, hojeIso, atualizarFrequencia } = useSupervisao();
  const turma = turmas.find(t => t.turma_id === turmaId);
  const aulas = useMemo(() => {
    if (!turma) return [];
    const inicio = periodoAtual?.data_inicio || somarDias(hojeIso, -120);
    const lista = [];
    for (let d = inicio; d <= hojeIso; d = somarDias(d, 1)) {
      lista.push(...aulasDoDia(d, [turma], horariosTurma, encontrosTurma, frequencias, matriculas).filter(a => a.situacao === 'PREVISTA'));
    }
    return lista.reverse();
  }, [turma, periodoAtual, hojeIso, horariosTurma, encontrosTurma, frequencias, matriculas]);
  const minhas = frequencias.filter(f => f.matricula_id === matriculaId);
  const contar = (s: Frequencia['status']) => minhas.filter(f => f.status === s).length;

  return (
    <Cartao className="p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {STATUS_FREQ.map(s => <Selo key={s.id} cor={s.cor}>{s.rotulo}: {contar(s.id)}</Selo>)}
      </div>
      {aulas.length === 0 ? <Vazio titulo="Nenhuma aula realizada ainda" /> : (
        <ul className="divide-y divide-slate-100">
          {aulas.map(a => {
            const f = minhas.find(x => x.data_aula === a.data);
            return (
              <li key={a.data} className="py-2.5 flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-32 font-medium text-slate-800 capitalize">{formatarDiaCurto(a.data)}</span>
                {!f && <span className="text-sm text-slate-400">sem chamada</span>}
                {f?.justificativa && <span className="text-sm text-slate-600 w-full sm:w-auto">“{f.justificativa}”</span>}
                <select
                  value={f?.status || ''}
                  onChange={e => void atualizarFrequencia(matriculaId, a.data, e.target.value as Frequencia['status'], f?.justificativa)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  aria-label={`Frequência em ${formatarDiaCurto(a.data)}`}
                >
                  {!f && <option value="">—</option>}
                  {STATUS_FREQ.map(s => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
};

const RssAluno: React.FC<{ matriculaId: string }> = ({ matriculaId }) => {
  const { getSituacaoRssEstudante, getGrupoDoAluno } = useSupervisao();
  const sit = getSituacaoRssEstudante(matriculaId);
  const grupo = getGrupoDoAluno(matriculaId);
  if (!sit) return <Vazio titulo="Sem dados de RSS" />;
  const registros = [...sit.registrosEstudante].sort((a, b) => Number((a as any).semana_rss ?? a.semana) - Number((b as any).semana_rss ?? b.semana));
  return (
    <Cartao className="p-4 space-y-3">
      <p className="text-lg text-slate-900">
        <strong>{sit.registrosRealizados}</strong> de <strong>{sit.registrosEsperadosAteHoje}</strong> esperados até hoje
        <span className="text-slate-500"> ({sit.totalPrevistoNoPeriodo} no semestre)</span>
        {sit.estaAtrasado ? <Selo cor="ambar" className="ml-2">faltam {Math.abs(sit.saldoRss)}</Selo> : <Selo cor="verde" className="ml-2">em dia</Selo>}
      </p>
      {grupo && <p className="text-sm text-slate-600">Na Clínica Ampliada o RSS é do grupo <strong>{grupo.nome_grupo}</strong>: o envio de qualquer integrante vale para todos.</p>}
      {registros.length === 0 ? <Vazio titulo="Nenhum RSS recebido" /> : (
        <ul className="divide-y divide-slate-100">
          {registros.map(reg => {
            const semana = obterSemanaRssValidada(reg);
            const revisao = String((reg as any).status_revisao || '').toUpperCase();
            return (
              <li key={reg.registro_id} className="py-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800 w-28">Semana {(reg as any).semana_rss || reg.semana || '?'}</span>
                <span className="text-sm text-slate-600 flex-1">{reg.data_entrega ? `recebido em ${formatarDataBr(reg.data_entrega)}` : ''}</span>
                {semana ? <Selo cor="verde">validado</Selo> : revisao === 'PENDENTE_REVISAO' ? <Selo cor="azul">em revisão</Selo> : <Selo>não conta</Selo>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-slate-500">O RSS chega pelo formulário dos estudantes; a revisão é feita na planilha.</p>
    </Cartao>
  );
};

const DOCS_PADRAO = ['TERMO_COMPROMISSO', 'MANUAL_ESTAGIO', 'DOCUMENTACAO_EXTERNA', 'TCLE'];
const ROTULO_DOC: Record<SituacaoEntrega, { t: string; c: 'verde' | 'ambar' | 'vermelho' | 'cinza' }> = {
  ENTREGUE: { t: 'Conferido', c: 'verde' }, A_CONFERIR: { t: 'A conferir', c: 'ambar' },
  PENDENTE: { t: 'Não entregue', c: 'vermelho' }, NAO_SE_APLICA: { t: 'Não se aplica', c: 'cinza' },
};

const DocumentosAluno: React.FC<{ matriculaId: string }> = ({ matriculaId }) => {
  const { entregas, atualizarEntregas, addEntrega } = useSupervisao();
  const docs = entregas.filter(e => e.matricula_id === matriculaId);
  const faltando = DOCS_PADRAO.filter(t => !docs.some(d => d.tipo_documento === t));
  return (
    <Cartao className="p-4 space-y-3">
      {docs.length === 0 ? <Vazio titulo="Nenhum documento registrado" /> : (
        <ul className="divide-y divide-slate-100">
          {docs.map(d => {
            const s = (d.situacao || 'PENDENTE') as SituacaoEntrega;
            const id = String(d.entrega_id);
            return (
              <li key={id} className="py-2.5 flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-40 font-medium text-slate-900">{nomeTipoEntrega(d.tipo_documento)}{d.prazo && <span className="text-sm text-slate-500"> · prazo {formatarDataBr(d.prazo)}</span>}</span>
                <Selo cor={ROTULO_DOC[s].c}>{ROTULO_DOC[s].t}</Selo>
                <Botao tamanho="sm" variante={s === 'ENTREGUE' ? 'sucesso' : 'secundario'} onClick={() => void atualizarEntregas([id], 'ENTREGUE')}>Ok</Botao>
                <Botao tamanho="sm" variante={s === 'PENDENTE' ? 'perigo' : 'secundario'} onClick={() => void atualizarEntregas([id], 'PENDENTE')}>Falta</Botao>
                <Botao tamanho="sm" variante="fantasma" onClick={() => void atualizarEntregas([id], 'NAO_SE_APLICA')}>N/A</Botao>
              </li>
            );
          })}
        </ul>
      )}
      {faltando.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <span className="text-sm text-slate-600 self-center">Adicionar:</span>
          {faltando.map(t => <Botao key={t} tamanho="sm" variante="fantasma" icone={<Plus className="w-4 h-4" />} onClick={() => void addEntrega(matriculaId, t, 'PENDENTE')}>{nomeTipoEntrega(t)}</Botao>)}
        </div>
      )}
    </Cartao>
  );
};

const NotasAluno: React.FC<{ matriculaId: string; turmaId: string }> = ({ matriculaId, turmaId }) => {
  const { getCriteriosDaTurma, avaliacoes, saveAvaliacao } = useSupervisao();
  const criterios = getCriteriosDaTurma(turmaId);
  const minhas = avaliacoes.filter(a => a.matricula_id === matriculaId);
  const total = criterios.reduce((s, c) => {
    const n = normalizarNota(minhas.find(a => a.criterio_id === c.criterio_id)?.nota);
    return typeof n === 'number' ? s + n : s;
  }, 0);
  const maximo = criterios.reduce((s, c) => s + (Number(String(c.nota_maxima).replace(',', '.')) || 0), 0);

  if (criterios.length === 0) return <Cartao><Vazio titulo="Sem critérios de avaliação para esta turma" texto="Os critérios vêm da aba criterios_avaliacao." /></Cartao>;
  return (
    <Cartao className="p-4 space-y-3">
      <p className="text-lg text-slate-900">Total: <strong>{formatarNotaParaExibicao(total)}</strong>{maximo > 0 && <span className="text-slate-500"> de {formatarNotaParaExibicao(maximo)}</span>}</p>
      <ul className="divide-y divide-slate-100">
        {criterios.map(c => {
          const atual = minhas.find(a => a.criterio_id === c.criterio_id);
          return (
            <li key={c.criterio_id} className="py-2.5 flex flex-wrap items-center gap-3">
              <span className="flex-1 min-w-48 text-slate-800">{c.nome}</span>
              <input
                key={`${c.criterio_id}-${atual?.nota ?? ''}`}
                defaultValue={atual?.nota !== undefined && String(atual.nota) !== '' ? String(atual.nota).replace('.', ',') : ''}
                inputMode="decimal"
                className={`${CLASSE_INPUT} w-24 text-center`}
                aria-label={`Nota em ${c.nome}`}
                onBlur={e => {
                  const n = normalizarNota(e.target.value);
                  if (typeof n === 'number' && n !== Number(atual?.nota)) void saveAvaliacao(matriculaId, c.criterio_id, n, atual?.observacao);
                }}
              />
              <span className="text-sm text-slate-500 w-14">/ {formatarNotaParaExibicao(c.nota_maxima)}</span>
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
};
