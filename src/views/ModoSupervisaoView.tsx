import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, BookOpen, CalendarClock, CalendarX, Check, ChevronRight, Clock, ListOrdered, MessageSquare,
  MoreVertical, Plus, Save, Search, Smartphone, Sparkles, Trash2,
} from 'lucide-react';
import { MarcacaoChamada, useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import { formatarDataBr, formatarDiaCurto } from '../services/supervisaoOperacionalService';
import { ModalNovaOrientacao, ModalNovoFeedback, ModalNovoPontoAcompanhamento, ModalRegistrarOcorrencia } from '../components/Modals';
import { EstudoDirigidoModal } from '../components/EstudoDirigidoModal';
import { ReagendarModal } from './TurmaView';
import { Botao, CLASSE_INPUT, Janela, Selo, Vazio } from '../components/ui';
import type { LeituraResponsavel } from '../types';

const VAZIA: MarcacaoChamada = { faltou: false, atraso: false, celular: false };
const chaveRascunho = (turmaId: string, data: string) => `cs_rascunho_chamada_${turmaId}_${data}`;

/**
 * Tela da aula (tablet): chamada por exceção à esquerda (todos começam presentes) e,
 * à direita, a ficha do estudante tocado ou a fila de casos para discutir.
 * A chamada fica salva como rascunho no aparelho até você tocar em "Salvar chamada".
 */
export const ModoSupervisaoView: React.FC<{ turmaId: string; dataAula: string }> = ({ turmaId, dataAula }) => {
  const {
    turmas, disciplinas, getAlunosDaTurma, getResumoAlunoSupervisao, frequencias, salvarChamada, hojeIso,
    getLeiturasDoEncontro, getResponsaveisLeitura, getAulasDoDia, getGrupoDoAluno, isTurmaClinicaAmpliada,
    togglePontoStatus, toggleOrientacaoStatus, marcarEncontroNaoRealizado, casosDiscussao,
  } = useSupervisao();
  const { voltar, abrirAluno, abrirPreparar } = useNavegacao();

  const turma = turmas.find(t => t.turma_id === turmaId);
  const alunos = getAlunosDaTurma(turmaId);
  const aula = getAulasDoDia(dataAula).find(a => a.turma.turma_id === turmaId);
  const leituras = getLeiturasDoEncontro(turmaId, dataAula);
  const ehHoje = dataAula === hojeIso;

  const salvoNaBase = useMemo(() => {
    const ids = new Set(alunos.map(a => a.matricula.matricula_id));
    const mapa: Record<string, MarcacaoChamada> = {};
    for (const f of frequencias) {
      if (f.data_aula !== dataAula || !ids.has(f.matricula_id)) continue;
      mapa[f.matricula_id] = {
        faltou: f.status !== 'PRESENTE', atraso: Boolean(f.atraso), celular: Boolean(f.celular),
        justificativa: f.justificativa || '', observacao: f.observacao || '',
      };
    }
    return mapa;
  }, [frequencias, alunos, dataAula]);
  const chamadaJaSalva = Object.keys(salvoNaBase).length > 0;

  const [marcacoes, setMarcacoes] = useState<Record<string, MarcacaoChamada>>(() => {
    try {
      const rascunho = localStorage.getItem(chaveRascunho(turmaId, dataAula));
      if (rascunho) return JSON.parse(rascunho);
    } catch { /* sem rascunho */ }
    return salvoNaBase;
  });
  const [alterado, setAlterado] = useState(() => {
    try { return Boolean(localStorage.getItem(chaveRascunho(turmaId, dataAula))); } catch { return false; }
  });
  const [salvando, setSalvando] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  // Rascunho automático: fechar o app ou a bateria acabar não perde as marcações.
  useEffect(() => {
    try {
      if (alterado) localStorage.setItem(chaveRascunho(turmaId, dataAula), JSON.stringify(marcacoes));
      else localStorage.removeItem(chaveRascunho(turmaId, dataAula));
    } catch { /* armazenamento indisponível */ }
  }, [marcacoes, alterado, turmaId, dataAula]);

  const marcar = (id: string, campo: 'faltou' | 'atraso' | 'celular') => {
    setMarcacoes(m => {
      const atual = m[id] || VAZIA;
      const novo = { ...atual, [campo]: !atual[campo] };
      if (campo === 'faltou' && novo.faltou) { novo.atraso = false; novo.celular = false; }
      if (campo !== 'faltou' && novo[campo]) novo.faltou = false;
      return { ...m, [id]: novo };
    });
    setAlterado(true);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarChamada(turmaId, dataAula, marcacoes);
      setAlterado(false);
      return true;
    } catch {
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const sair = () => (alterado ? setConfirmarSaida(true) : voltar());

  const faltas = alunos.filter(a => marcacoes[a.matricula.matricula_id]?.faltou).length;
  const atrasos = alunos.filter(a => marcacoes[a.matricula.matricula_id]?.atraso).length;

  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState(alunos[0]?.matricula.matricula_id || '');
  const [painel, setPainel] = useState<'LISTA' | 'ESTUDANTE' | 'CASOS'>('LISTA');
  const [painelDireito, setPainelDireito] = useState<'ESTUDANTE' | 'CASOS'>('ESTUDANTE');
  const [modal, setModal] = useState<'orientacao' | 'feedback' | 'ponto' | 'ocorrencia' | 'mais' | 'naoRealizada' | 'reagendar' | null>(null);
  const [menu, setMenu] = useState(false);
  const [leituraAberta, setLeituraAberta] = useState<LeituraResponsavel | null>(null);
  const [maisId, setMaisId] = useState('');

  const filtrados = alunos.filter(a => a.aluno.nome.toLowerCase().includes(busca.toLowerCase()));
  const resumo = selecionado ? getResumoAlunoSupervisao(selecionado) : null;
  const grupoSelecionado = selecionado && isTurmaClinicaAmpliada(turmaId) ? getGrupoDoAluno(selecionado) : undefined;
  const casosAbertos = casosDiscussao.filter(c => c.turma_id === turmaId && c.status !== 'DISCUTIDO').length;
  const mostrarCasos = painel === 'CASOS' || (painel === 'LISTA' && painelDireito === 'CASOS');

  if (!turma) return <Vazio titulo="Turma não encontrada" />;

  return (
    <div className="h-dvh flex flex-col bg-slate-100">
      {/* Cabeçalho da aula */}
      <header className="bg-slate-900 text-white px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 shrink-0">
        <Botao variante="fantasma" tamanho="sm" className="text-white hover:bg-slate-800" onClick={sair} icone={<ArrowLeft className="w-5 h-5" />}>Sair</Botao>
        <div className="flex-1 min-w-40">
          <p className="font-bold leading-tight">{turma.nome}</p>
          <p className="text-sm text-slate-300 capitalize">
            {formatarDiaCurto(dataAula)}{aula?.horaInicio && ` · ${aula.horaInicio}–${aula.horaFim}`} · {disciplinas.find(d => d.disciplina_id === turma.disciplina_id)?.codigo}
          </p>
        </div>
        <div className="text-sm text-slate-200 hidden sm:block">
          <strong className="text-emerald-300">{alunos.length - faltas}</strong> presentes · <strong className={faltas ? 'text-red-300' : ''}>{faltas}</strong> falta(s){atrasos ? ` · ${atrasos} atraso(s)` : ''}
        </div>
        <Botao variante={alterado ? 'destaque' : 'secundario'} onClick={() => void salvar()} disabled={salvando} icone={<Save className="w-4 h-4" />}>
          {salvando ? 'Salvando…' : alterado ? 'Salvar chamada' : chamadaJaSalva ? 'Chamada salva ✓' : 'Salvar chamada'}
        </Botao>
        <div className="relative">
          <button onClick={() => setMenu(m => !m)} aria-label="Mais opções" className="p-2 rounded-xl hover:bg-slate-800 cursor-pointer"><MoreVertical className="w-5 h-5" /></button>
          {menu && (
            <div className="absolute right-0 top-11 z-30 w-60 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-1" onMouseLeave={() => setMenu(false)}>
              <button className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex gap-2 cursor-pointer" onClick={() => { setMenu(false); abrirPreparar(turmaId, dataAula); }}><Sparkles className="w-4 h-4" /> Resumo da turma</button>
              <button className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex gap-2 cursor-pointer" onClick={() => { setMenu(false); setModal('naoRealizada'); }}><CalendarX className="w-4 h-4" /> Não houve aula</button>
              <button className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex gap-2 cursor-pointer" onClick={() => { setMenu(false); setModal('reagendar'); }}><CalendarClock className="w-4 h-4" /> Reagendar esta aula</button>
            </div>
          )}
        </div>
      </header>

      {!ehHoje && (
        <div className="bg-amber-100 text-amber-950 px-4 py-2 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Chamada da aula de <strong className="capitalize">{formatarDiaCurto(dataAula)}</strong> (não é hoje).
        </div>
      )}
      {aula && aula.situacao !== 'PREVISTA' && (
        <div className="bg-amber-100 text-amber-950 px-4 py-2 text-sm">Esta aula está marcada como <strong>{aula.situacao === 'REAGENDADA' ? 'reagendada' : 'não realizada'}</strong> ({aula.motivo}). Salvar a chamada a marca como realizada.</div>
      )}

      {/* Estudo dirigido / leituras da aula */}
      {leituras.length > 0 && (
        <div className="bg-violet-50 border-b border-violet-200 px-4 py-2 flex flex-wrap gap-x-6 gap-y-2">
          {leituras.map(l => {
            const resp = getResponsaveisLeitura(l);
            return (
              <div key={l.leitura_id} className="flex items-center gap-2 text-sm min-w-0">
                <BookOpen className="w-4 h-4 text-violet-700 shrink-0" />
                <span className="min-w-0"><strong className="text-slate-900">{l.tema}</strong>{resp.length > 0 && <span className="text-slate-700"> — {resp.map(r => r.nome).join(', ')}</span>}</span>
                {String(l.tipo).toUpperCase() === 'ESTUDO_DIRIGIDO' && (
                  l.status_realizacao
                    ? <button onClick={() => setLeituraAberta(l)} className="cursor-pointer"><Selo cor="verde">{l.status_realizacao === 'REALIZADO' ? 'apresentado' : l.status_realizacao.toLowerCase().replace('_', ' ')}</Selo></button>
                    : <Botao tamanho="sm" onClick={() => setLeituraAberta(l)}>Registrar</Botao>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Alternador no celular */}
      <div className="md:hidden flex bg-slate-200 p-1 gap-1">
        {([['LISTA', 'Chamada'], ['ESTUDANTE', 'Estudante'], ['CASOS', `Casos${casosAbertos ? ` (${casosAbertos})` : ''}`]] as const).map(([id, rotulo]) => (
          <button key={id} onClick={() => setPainel(id)} className={`flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer ${painel === id ? 'bg-white text-slate-900' : 'text-slate-600'}`}>{rotulo}</button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Chamada por exceção */}
        <section className={`w-full md:w-[420px] lg:w-[460px] bg-white border-r border-slate-200 flex-col min-h-0 ${painel === 'LISTA' ? 'flex' : 'hidden md:flex'}`}>
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className={`${CLASSE_INPUT} pl-9`} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar estudante…" />
            </div>
            <p className="text-sm text-slate-500 mt-2">Todos começam <strong>presentes</strong>. Marque só as exceções.</p>
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filtrados.map(({ matricula, aluno }) => {
              const id = matricula.matricula_id;
              const m = marcacoes[id] || VAZIA;
              const r = getResumoAlunoSupervisao(id);
              const ativo = id === selecionado;
              return (
                <li key={id} className={`flex items-center gap-2 px-3 py-2 ${ativo ? 'bg-slate-100' : ''}`}>
                  <button onClick={() => { setSelecionado(id); setPainelDireito('ESTUDANTE'); setPainel('ESTUDANTE'); }} className="flex-1 min-w-0 text-left py-1 cursor-pointer">
                    <span className={`block font-semibold truncate ${m.faltou ? 'text-red-700 line-through' : 'text-slate-900'}`}>
                      {aluno.nome} {r?.statusAtencao === 'PRIORIDADE' ? '🔴' : r?.temAtencao ? '🟡' : ''}
                    </span>
                    {(m.justificativa || m.observacao) && <span className="block text-xs text-slate-500 truncate">{m.justificativa ? `Justificativa: ${m.justificativa}` : m.observacao}</span>}
                  </button>
                  <button onClick={() => marcar(id, 'faltou')} className={`min-h-11 min-w-16 px-2 rounded-xl text-sm font-bold cursor-pointer ${m.faltou ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-red-50'}`}>
                    {m.faltou ? 'Faltou' : 'Falta'}
                  </button>
                  <button onClick={() => marcar(id, 'atraso')} aria-label="Atraso" title="Atraso" className={`min-h-11 min-w-11 rounded-xl flex flex-col items-center justify-center cursor-pointer ${m.atraso ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Clock className="w-4 h-4" /><span className="text-[11px] leading-none mt-0.5">atraso</span>
                  </button>
                  <button onClick={() => marcar(id, 'celular')} aria-label="Celular" title="Uso de celular" className={`min-h-11 min-w-11 rounded-xl flex flex-col items-center justify-center cursor-pointer ${m.celular ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Smartphone className="w-4 h-4" /><span className="text-[11px] leading-none mt-0.5">celular</span>
                  </button>
                  <button onClick={() => { setMaisId(id); setModal('mais'); }} aria-label="Justificativa ou observação" className="min-h-11 min-w-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer">
                    <Plus className="w-5 h-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Painel direito: estudante ou fila de casos */}
        <section className={`flex-1 min-h-0 overflow-y-auto p-4 md:p-6 ${painel === 'LISTA' ? 'hidden md:block' : 'block'}`}>
          <div className="hidden md:flex gap-2 mb-4">
            <Botao tamanho="sm" variante={!mostrarCasos ? 'primario' : 'secundario'} onClick={() => { setPainelDireito('ESTUDANTE'); setPainel('ESTUDANTE'); }}>Estudante</Botao>
            <Botao tamanho="sm" variante={mostrarCasos ? 'primario' : 'secundario'} onClick={() => { setPainelDireito('CASOS'); setPainel('CASOS'); }} icone={<ListOrdered className="w-4 h-4" />}>
              Fila de casos {casosAbertos > 0 && `(${casosAbertos})`}
            </Botao>
          </div>

          {mostrarCasos ? (
            <FilaCasos turmaId={turmaId} />
          ) : !resumo ? (
            <Vazio titulo="Toque em um estudante para ver o resumo" />
          ) : (
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{resumo.aluno.nome}</h2>
                  {grupoSelecionado && <p className="text-slate-600">{grupoSelecionado.nome_grupo}</p>}
                </div>
                <Botao tamanho="sm" onClick={() => abrirAluno(resumo.matricula.matricula_id)}>Ficha completa <ChevronRight className="w-4 h-4" /></Botao>
              </div>

              {resumo.motivosAtencao.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {resumo.motivosAtencao.map(m => <Selo key={m} cor={resumo.statusAtencao === 'PRIORIDADE' ? 'vermelho' : 'ambar'}>{m}</Selo>)}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Botao variante="primario" onClick={() => setModal('orientacao')} icone={<Plus className="w-4 h-4" />}>Orientação</Botao>
                <Botao onClick={() => setModal('feedback')} icone={<MessageSquare className="w-4 h-4" />}>Feedback</Botao>
                <Botao onClick={() => setModal('ponto')} icone={<Check className="w-4 h-4" />}>Acompanhar</Botao>
                <Botao onClick={() => setModal('ocorrencia')} icone={<AlertTriangle className="w-4 h-4" />}>Ocorrência</Botao>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900 mb-2">Para acompanhar</h3>
                {resumo.pontosAtivos.length === 0 ? <p className="text-sm text-slate-500">Nenhum ponto em aberto.</p> : (
                  <ul className="space-y-2">
                    {resumo.pontosAtivos.map(p => (
                      <li key={p.ponto_id} className="flex items-start gap-3">
                        <button onClick={() => void togglePontoStatus(p.ponto_id)} aria-label="Concluir" className="mt-0.5 w-6 h-6 rounded-md border-2 border-slate-300 hover:border-emerald-500 cursor-pointer shrink-0" />
                        <span className="text-slate-800">{p.texto} {p.prioridade === 'ALTA' && <Selo cor="vermelho">alta</Selo>}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900 mb-2">Últimas orientações</h3>
                {resumo.ultimasOrientacoes.length === 0 ? <p className="text-sm text-slate-500">Nenhuma orientação registrada.</p> : (
                  <ul className="space-y-3">
                    {resumo.ultimasOrientacoes.map(o => (
                      <li key={o.orientacao_id} className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-slate-500">{o.categoria} · {formatarDataBr(String(o.data_hora).slice(0, 10), true)}</p>
                          <p className="text-slate-800 whitespace-pre-wrap">{o.texto}</p>
                        </div>
                        <Botao tamanho="sm" variante={o.status === 'ABERTA' ? 'secundario' : 'fantasma'} onClick={() => void toggleOrientacaoStatus(o.orientacao_id)}>
                          {o.status === 'ABERTA' ? 'Concluir' : 'Reabrir'}
                        </Botao>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Janelas */}
      {resumo && modal === 'orientacao' && <ModalNovaOrientacao matriculaId={resumo.matricula.matricula_id} alunoNome={resumo.aluno.nome} grupo={grupoSelecionado} onClose={() => setModal(null)} />}
      {resumo && modal === 'feedback' && <ModalNovoFeedback matriculaId={resumo.matricula.matricula_id} alunoNome={resumo.aluno.nome} onClose={() => setModal(null)} />}
      {resumo && modal === 'ponto' && <ModalNovoPontoAcompanhamento matriculaId={resumo.matricula.matricula_id} alunoNome={resumo.aluno.nome} onClose={() => setModal(null)} />}
      {resumo && modal === 'ocorrencia' && <ModalRegistrarOcorrencia matriculaId={resumo.matricula.matricula_id} alunoNome={resumo.aluno.nome} onClose={() => setModal(null)} />}
      {modal === 'mais' && maisId && (
        <JanelaExcecao
          nome={alunos.find(a => a.matricula.matricula_id === maisId)?.aluno.nome || ''}
          valor={marcacoes[maisId] || VAZIA}
          aoSalvar={v => { setMarcacoes(m => ({ ...m, [maisId]: v })); setAlterado(true); setModal(null); }}
          aoFechar={() => setModal(null)}
        />
      )}
      {modal === 'naoRealizada' && (
        <JanelaNaoRealizada aoFechar={() => setModal(null)} aoConfirmar={async (motivo, obs) => {
          await marcarEncontroNaoRealizado(turmaId, dataAula, motivo, obs);
          setAlterado(false);
          voltar();
        }} />
      )}
      {modal === 'reagendar' && <ReagendarModal turmaId={turmaId} data={dataAula} aoFechar={() => setModal(null)} />}
      {leituraAberta && <EstudoDirigidoModal leitura={leituraAberta} aoFechar={() => setLeituraAberta(null)} />}
      {confirmarSaida && (
        <Janela titulo="A chamada não foi salva" aoFechar={() => setConfirmarSaida(false)} largura="sm"
          rodape={<>
            <Botao variante="fantasma" onClick={() => { setAlterado(false); setConfirmarSaida(false); voltar(); }}>Descartar</Botao>
            <Botao onClick={() => setConfirmarSaida(false)}>Continuar na aula</Botao>
            <Botao variante="primario" onClick={async () => { if (await salvar()) voltar(); }}>Salvar e sair</Botao>
          </>}>
          <p className="text-slate-700">As marcações ficam guardadas como rascunho neste aparelho, mas só entram na planilha quando você salvar.</p>
        </Janela>
      )}
    </div>
  );
};

const JanelaExcecao: React.FC<{ nome: string; valor: MarcacaoChamada; aoSalvar: (v: MarcacaoChamada) => void; aoFechar: () => void }> = ({ nome, valor, aoSalvar, aoFechar }) => {
  const [v, setV] = useState(valor);
  return (
    <Janela titulo={nome} subtitulo="Justificativa ou observação" aoFechar={aoFechar} largura="sm"
      rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" onClick={() => aoSalvar(v)}>Aplicar</Botao></>}>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-slate-800"><input type="checkbox" className="w-5 h-5" checked={v.faltou} onChange={e => setV({ ...v, faltou: e.target.checked })} /> Faltou</label>
        {v.faltou && (
          <input className={CLASSE_INPUT} value={v.justificativa || ''} onChange={e => setV({ ...v, justificativa: e.target.value })} placeholder="Justificativa apresentada (ex.: atestado)" />
        )}
        <input className={CLASSE_INPUT} value={v.observacao || ''} onChange={e => setV({ ...v, observacao: e.target.value })} placeholder="Observação (opcional)" />
        <p className="text-sm text-slate-500">Falta com justificativa fica para você aceitar ou recusar depois, em Pendências.</p>
      </div>
    </Janela>
  );
};

const MOTIVOS = ['Feriado', 'Recesso acadêmico', 'Cancelamento institucional', 'Cancelamento da professora', 'Outro'];

const JanelaNaoRealizada: React.FC<{ aoFechar: () => void; aoConfirmar: (motivo: string, obs: string) => Promise<void> }> = ({ aoFechar, aoConfirmar }) => {
  const [motivo, setMotivo] = useState(MOTIVOS[3]);
  const [obs, setObs] = useState('');
  return (
    <Janela titulo="Não houve aula" subtitulo="Não gera faltas nem chamada pendente" aoFechar={aoFechar} largura="sm"
      rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" onClick={() => void aoConfirmar(motivo, obs)}>Confirmar</Botao></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{MOTIVOS.map(m => <Botao key={m} tamanho="sm" variante={motivo === m ? 'primario' : 'secundario'} onClick={() => setMotivo(m)}>{m}</Botao>)}</div>
        <input className={CLASSE_INPUT} value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação (opcional)" />
      </div>
    </Janela>
  );
};

/** Fila de casos para discutir na supervisão (persistida na aba preparacoes_aula). */
export const FilaCasos: React.FC<{ turmaId: string; semTitulo?: boolean }> = ({ turmaId, semTitulo }) => {
  const { casosDiscussao, addCaso, marcarCasoDiscutido, solicitarExclusao, getAlunosDaTurma, gruposPratica } = useSupervisao();
  const [alvo, setAlvo] = useState('TURMA');
  const [texto, setTexto] = useState('');
  const alunos = getAlunosDaTurma(turmaId);
  const grupos = gruposPratica.filter(g => g.turma_id === turmaId);
  const casos = casosDiscussao.filter(c => c.turma_id === turmaId)
    .sort((a, b) => (a.status === 'DISCUTIDO' ? 1 : 0) - (b.status === 'DISCUTIDO' ? 1 : 0) || Number(a.ordem || 0) - Number(b.ordem || 0));

  const adicionar = async () => {
    if (!texto.trim()) return;
    const [tipo, id] = alvo.split(':');
    const nome = tipo === 'ALUNO' ? alunos.find(a => a.matricula.matricula_id === id)?.aluno.nome
      : tipo === 'GRUPO' ? grupos.find(g => g.grupo_id === id)?.nome_grupo : 'Turma';
    await addCaso(turmaId, { alvo_tipo: tipo as 'ALUNO' | 'GRUPO' | 'TURMA', alvo_id: id, alvo_nome: nome || 'Turma', texto: texto.trim() });
    setTexto('');
  };

  return (
    <div className="max-w-3xl space-y-4">
      {!semTitulo && (
        <div>
          <h2 className="text-xl font-black text-slate-900">Fila de casos</h2>
          <p className="text-slate-600">O que discutir nesta supervisão, na ordem. Fica salvo para a próxima aula.</p>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
        <select className={CLASSE_INPUT} value={alvo} onChange={e => setAlvo(e.target.value)}>
          <option value="TURMA">Turma toda</option>
          {grupos.map(g => <option key={g.grupo_id} value={`GRUPO:${g.grupo_id}`}>Grupo: {g.nome_grupo}</option>)}
          {alunos.map(a => <option key={a.matricula.matricula_id} value={`ALUNO:${a.matricula.matricula_id}`}>{a.aluno.nome}</option>)}
        </select>
        <div className="flex gap-2">
          <input className={CLASSE_INPUT} value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && void adicionar()} placeholder="Assunto (ex.: paciente faltou 2 vezes)" />
          <Botao variante="primario" onClick={() => void adicionar()} disabled={!texto.trim()} icone={<Plus className="w-4 h-4" />}>Adicionar</Botao>
        </div>
      </div>
      {casos.length === 0 ? <Vazio titulo="Nenhum caso na fila" /> : (
        <ul className="space-y-2">
          {casos.map((c, i) => (
            <li key={c.preparacao_id} className={`bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3 ${c.status === 'DISCUTIDO' ? 'opacity-60' : ''}`}>
              <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-500">{c.alvo_nome}</p>
                <p className={`text-slate-900 ${c.status === 'DISCUTIDO' ? 'line-through' : ''}`}>{c.texto}</p>
              </div>
              <Botao tamanho="sm" variante={c.status === 'DISCUTIDO' ? 'fantasma' : 'sucesso'} onClick={() => void marcarCasoDiscutido(c.preparacao_id, c.status !== 'DISCUTIDO')}>
                {c.status === 'DISCUTIDO' ? 'Reabrir' : 'Discutido'}
              </Botao>
              <button onClick={() => solicitarExclusao({ nome: 'Caso', tabela: 'preparacoes_aula', registro: c })} aria-label="Excluir" className="p-2 text-slate-400 hover:text-red-600 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

