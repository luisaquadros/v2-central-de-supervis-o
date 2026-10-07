import React, { useState, useMemo } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  MessageSquare,
  FileCheck,
  CalendarCheck,
  ChevronRight,
  ArrowLeft,
  X,
  FileText,
  UserCheck,
  Check,
  Smartphone,
  Save,
  RotateCcw,
  Calendar,
  Users,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import {
  ModalNovaOrientacao,
  ModalNovoFeedback,
  ModalRegistrarOcorrencia,
  ModalNovoPontoAcompanhamento,
} from '../components/Modals';
import { Frequencia, MotivoNaoRealizado } from '../types';

interface ModoSupervisaoViewProps {
  turmaId: string;
  onEncerrar: () => void;
  onOpenFichaAluno: (matriculaId: string, initialTab?: string) => void;
}

interface ExcecaoAluno {
  faltou: boolean;
  atraso: boolean;
  celular: boolean;
  justificativa?: string;
  observacao?: string;
}

export const ModoSupervisaoView: React.FC<ModoSupervisaoViewProps> = ({
  turmaId,
  onEncerrar,
  onOpenFichaAluno,
}) => {
  const {
    turmas,
    disciplinas,
    matriculas,
    alunos,
    gruposPratica,
    grupoIntegrantes,
    getAlunosDaTurma,
    getResumoAlunoSupervisao,
    toggleOrientacaoStatus,
    togglePontoStatus,
    leiturasResponsaveis,
    atualizarStatusEstudoDirigido,
    salvarChamadaPorExcecao,
    marcarEncontroNaoRealizado,
    reagendarEncontro,
    encontrosTurma,
    frequencias,
    saveStatus,
    isTokenExpired,
    tokenExpiredAviso,
    reconectarESincronizar,
  } = useSupervisao();

  const turma = turmas.find(t => t.turma_id === turmaId);
  const disciplina = disciplinas.find(d => d.disciplina_id === turma?.disciplina_id);
  const alunosLista = getAlunosDaTurma(turmaId);

  const hojeIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 1. Verificação de Encontro de Hoje (Cancelado / Reagendado / Realizado)
  const encontroHoje = encontrosTurma.find(
    e => e.turma_id === turmaId && e.data === hojeIso
  );

  // 2. Estudo Dirigido de Hoje programado para esta turma
  const estudoDirigidoHoje = useMemo(() => {
    return (
      leiturasResponsaveis.find(l => l.turma_id === turmaId && l.data === hojeIso) ||
      leiturasResponsaveis.find(l => l.turma_id === turmaId)
    );
  }, [leiturasResponsaveis, turmaId, hojeIso]);

  // Resolução dinâmica e robusta de responsáveis pelo estudo dirigido/leitura de hoje
  const responsaveisEstudo = useMemo(() => {
    if (!estudoDirigidoHoje) return [];

    const list: { matriculaId: string; nome: string; papel?: string; tipo: 'TITULAR' | 'SUBSTITUTO' | 'GRUPO' }[] = [];

    const parseIds = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(v => String(v).trim());
      if (typeof val === 'string') {
        return val
          .split(/[;,]/)
          .map(s => s.trim())
          .filter(Boolean);
      }
      return [String(val).trim()];
    };

    // A. Se tem grupo_id associado à leitura
    if (estudoDirigidoHoje.grupo_id) {
      const grupo = gruposPratica.find(g => g.grupo_id === estudoDirigidoHoje.grupo_id);
      if (grupo) {
        const ints = grupoIntegrantes.filter(gi => gi.grupo_id === grupo.grupo_id);
        ints.forEach(gi => {
          let mat = matriculas.find(m => m.matricula_id === gi.matricula_id || m.aluno_id === gi.aluno_id);
          let al = alunos.find(a => a.aluno_id === gi.aluno_id || (mat && a.aluno_id === mat.aluno_id));
          if (al) {
            list.push({
              matriculaId: mat?.matricula_id || gi.matricula_id || '',
              nome: al.nome,
              papel: gi.papel || 'Integrante',
              tipo: 'GRUPO'
            });
          }
        });
      }
    }

    // B. Se tem responsaveis_previstos
    const previstos = parseIds(estudoDirigidoHoje.responsaveis_previstos);
    if (previstos.length > 0) {
      previstos.forEach((pId: string) => {
        if (list.some(item => item.matriculaId === pId)) return;
        const mat = matriculas.find(m => m.matricula_id === pId);
        const al = alunos.find(a => a.aluno_id === mat?.aluno_id || a.aluno_id === pId);
        if (al) {
          list.push({
            matriculaId: pId,
            nome: al.nome,
            tipo: 'TITULAR'
          });
        }
      });
    }

    // C. Se tem responsaveis_efetivos
    const efetivos = parseIds(estudoDirigidoHoje.responsaveis_efetivos);
    if (efetivos.length > 0) {
      efetivos.forEach((eId: string) => {
        const idx = list.findIndex(item => item.matriculaId === eId);
        if (idx >= 0) {
          list[idx].tipo = 'TITULAR';
        } else {
          const mat = matriculas.find(m => m.matricula_id === eId);
          const al = alunos.find(a => a.aluno_id === mat?.aluno_id || a.aluno_id === eId);
          if (al) {
            list.push({
              matriculaId: eId,
              nome: al.nome,
              tipo: 'SUBSTITUTO'
            });
          }
        }
      });
    }

    // D. Fallback individual
    if (list.length === 0) {
      if (estudoDirigidoHoje.responsavel_id) {
        const mat = matriculas.find(m => m.matricula_id === estudoDirigidoHoje.responsavel_id);
        const al = alunos.find(a => a.aluno_id === mat?.aluno_id || a.aluno_id === estudoDirigidoHoje.responsavel_id);
        if (al) {
          list.push({
            matriculaId: estudoDirigidoHoje.responsavel_id,
            nome: al.nome,
            tipo: 'TITULAR'
          });
        }
      } else if (estudoDirigidoHoje.responsavel_nome) {
        list.push({
          matriculaId: estudoDirigidoHoje.responsavel_id || '',
          nome: estudoDirigidoHoje.responsavel_nome,
          tipo: 'TITULAR'
        });
      }
    }

    return list;
  }, [estudoDirigidoHoje, gruposPratica, grupoIntegrantes, matriculas, alunos]);

  const nomeGrupoEstudo = useMemo(() => {
    if (!estudoDirigidoHoje || !estudoDirigidoHoje.grupo_id) return null;
    const grupo = gruposPratica.find(g => g.grupo_id === estudoDirigidoHoje.grupo_id);
    return grupo ? grupo.nome_grupo || grupo.descricao : null;
  }, [estudoDirigidoHoje, gruposPratica]);

  const renderStatusEstudoBadge = (status?: string) => {
    if (!status) return null;
    let label = status;
    let colorClass = 'bg-slate-100 text-slate-800 border-slate-200';
    if (status === 'PLANEJADO') {
      label = 'Previsto';
      colorClass = 'bg-blue-50 text-blue-800 border-blue-200';
    } else if (status === 'REALIZADO') {
      label = 'Realizado';
      colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (status === 'PARCIAL') {
      label = 'Parcial';
      colorClass = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (status === 'NAO_REALIZADO') {
      label = 'Não Realizado';
      colorClass = 'bg-red-50 text-red-800 border-red-200';
    } else if (status === 'SUBSTITUICAO') {
      label = 'Substituição';
      colorClass = 'bg-purple-50 text-purple-800 border-purple-200';
    }

    return (
      <span className={`inline-block font-bold text-[10px] px-1.5 py-0.5 rounded border ${colorClass} uppercase ml-2`}>
        {label}
      </span>
    );
  };

  // 3. Chamada por Exceção: Estado em memória durante a aula
  // Por padrão: todos presentes (excecoes vazias = presentes).
  const [excecoes, setExcecoes] = useState<Record<string, ExcecaoAluno>>(() => {
    // Se a chamada já foi salva hoje, inicializa a partir das frequências salvas
    const initialMap: Record<string, ExcecaoAluno> = {};
    const freqsHoje = frequencias.filter(f => f.data_aula === hojeIso);
    freqsHoje.forEach(f => {
      const isFalta = f.status !== 'PRESENTE';
      if (isFalta || f.atraso || f.celular || f.justificativa || f.observacao) {
        initialMap[f.matricula_id] = {
          faltou: isFalta,
          atraso: !!f.atraso,
          celular: !!f.celular,
          justificativa: f.justificativa || '',
          observacao: f.observacao || '',
        };
      }
    });
    return initialMap;
  });

  const [chamadaSalvaMsg, setChamadaSalvaMsg] = useState<{
    texto: string;
    tipo: 'remoto' | 'local';
    tokenExpirado?: boolean;
  } | null>(null);
  const [mobileTab, setMobileTab] = useState<'LISTA' | 'DETALHE'>('LISTA');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatriculaId, setSelectedMatriculaId] = useState<string>(() => {
    return alunosLista.length > 0 ? alunosLista[0].matricula.matricula_id : '';
  });

  // Modals operacionais
  const [modalType, setModalType] = useState<
    'orientacao' | 'feedback' | 'atraso' | 'ocorrencia' | 'ponto' | 'naoRealizada' | 'reagendar' | 'maisExcecao' | null
  >(null);
  const [matriculaParaMais, setMatriculaParaMais] = useState<string>('');

  // Estados dos formulários de aula não realizada / reagendamento
  const [motivoNaoRealizada, setMotivoNaoRealizada] = useState<MotivoNaoRealizado>('Cancelamento institucional');
  const [obsNaoRealizada, setObsNaoRealizada] = useState('');
  const [novaDataReagendada, setNovaDataReagendada] = useState('');
  const [novoHorarioReagendado, setNovoHorarioReagendado] = useState('');
  const [motivoReagendamento, setMotivoReagendamento] = useState('');
  const [transferirEstudoCheck, setTransferirEstudoCheck] = useState(true);

  // Estado para seleção de substituição de estudo dirigido
  const [modoSubstituicao, setModoSubstituicao] = useState(false);
  const [alunoSubstitutoId, setAlunoSubstitutoId] = useState('');
  const [motivoSubstituicao, setMotivoSubstituicao] = useState('');

  // Helper de exceções
  const toggleFaltou = (matriculaId: string) => {
    setExcecoes(prev => {
      const atual = prev[matriculaId] || { faltou: false, atraso: false, celular: false };
      return {
        ...prev,
        [matriculaId]: {
          ...atual,
          faltou: !atual.faltou,
        },
      };
    });
  };

  const toggleAtraso = (matriculaId: string) => {
    setExcecoes(prev => {
      const atual = prev[matriculaId] || { faltou: false, atraso: false, celular: false };
      return {
        ...prev,
        [matriculaId]: {
          ...atual,
          atraso: !atual.atraso,
        },
      };
    });
  };

  const toggleCelular = (matriculaId: string) => {
    setExcecoes(prev => {
      const atual = prev[matriculaId] || { faltou: false, atraso: false, celular: false };
      return {
        ...prev,
        [matriculaId]: {
          ...atual,
          celular: !atual.celular,
        },
      };
    });
  };

  // Salvar chamada por exceção
  const handleSalvarChamada = async () => {
    const excecoesArray = alunosLista.map(item => {
      const exc = excecoes[item.matricula.matricula_id];
      const faltou = exc?.faltou ?? false;
      let status: Frequencia['status'] = 'PRESENTE';
      if (faltou) {
        status = exc?.justificativa ? 'JUSTIFICATIVA_PENDENTE' : 'FALTA_SEM_JUSTIFICATIVA';
      }
      return {
        matriculaId: item.matricula.matricula_id,
        status,
        justificativa: exc?.justificativa,
        atraso: exc?.atraso,
        celular: exc?.celular,
        observacao: exc?.observacao,
      };
    });

    const res = await salvarChamadaPorExcecao(turmaId, hojeIso, excecoesArray);
    const faltasCount = Object.values(excecoes).filter(e => e.faltou).length;
    const presentesCount = alunosLista.length - faltasCount;
    setChamadaSalvaMsg({
      texto: `${res.statusTexto} — ${presentesCount} presentes, ${faltasCount} falta(s).`,
      tipo: res.sincronizadoRemoto ? 'remoto' : 'local',
      tokenExpirado: res.tokenExpirado,
    });
    setTimeout(() => setChamadaSalvaMsg(null), 6000);
  };

  // Contagem instantânea em memória
  const faltasCount = Object.values(excecoes).filter(e => e.faltou).length;
  const presentesCount = alunosLista.length - faltasCount;
  const atrasosCount = Object.values(excecoes).filter(e => e.atraso).length;
  const celularCount = Object.values(excecoes).filter(e => e.celular).length;

  // Filtro de alunos
  const filteredAlunos = alunosLista.filter(item =>
    item.aluno.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resumoAluno = selectedMatriculaId ? getResumoAlunoSupervisao(selectedMatriculaId) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-2.5rem)] -m-4 sm:-m-6 bg-slate-100 overflow-hidden font-sans">
      {/* 1. TOP HEADER DE NAVEGAÇÃO E AÇÕES RÁPIDAS DA AULA */}
      <header className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onEncerrar}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Encerrar Modo Supervisão"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                Modo Supervisão
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {disciplina?.nome} · Turno {turma?.turno}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5">{turma?.nome}</h2>
          </div>
        </div>

        {/* Ações operacionais da aula: Não realizada, Reagendar, Encerrar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setModalType('naoRealizada')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium transition-colors cursor-pointer border border-slate-700"
            title="Registrar que esta aula não ocorreu (feriado, cancelamento, etc.)"
          >
            Marcar não realizada
          </button>

          <button
            onClick={() => setModalType('reagendar')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer border border-slate-700"
            title="Reagendar supervisão para outra data"
          >
            Reagendar
          </button>

          <button
            onClick={onEncerrar}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Encerrar
          </button>
        </div>
      </header>

      {/* AVISO DE AULA NÃO REALIZADA / FERIADO (SE APLICÁVEL) */}
      {encontroHoje && encontroHoje.status === 'NAO_REALIZADO' && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Atenção:</strong> Esta aula está registrada como <strong>NÃO REALIZADA</strong> (
              {encontroHoje.motivo_nao_realizado}). Não serão geradas faltas ou chamada pendente.
            </span>
          </div>
          <span className="font-mono text-[11px] text-amber-800">
            {encontroHoje.observacao || ''}
          </span>
        </div>
      )}

      {/* 2. TOPO DO MODO SUPERVISÃO: ESTUDO DIRIGIDO / LEITURA DE HOJE */}
      {estudoDirigidoHoje && (
        <section className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 shrink-0 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start md:items-center gap-2.5">
              <span className="bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] uppercase shrink-0">
                Estudo Dirigido Hoje
              </span>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900">
                    {estudoDirigidoHoje.tema || estudoDirigidoHoje.artigo_leitura || 'Apresentação de Artigo / Caso'}
                  </span>
                  {estudoDirigidoHoje.artigo_leitura && estudoDirigidoHoje.tema && (
                    <span className="text-slate-600 font-medium">
                      · {estudoDirigidoHoje.artigo_leitura}
                    </span>
                  )}
                  {renderStatusEstudoBadge(estudoDirigidoHoje.status_realizacao)}
                </div>

                {nomeGrupoEstudo && (
                  <div className="text-slate-800 font-semibold mt-0.5 text-[11px]">
                    Grupo: <span className="underline">{nomeGrupoEstudo}</span>
                  </div>
                )}

                {responsaveisEstudo.length > 0 ? (
                  <div className="mt-1 text-[11px] text-slate-700">
                    <span className="font-bold">Responsáveis: </span>
                    <span className="inline-flex gap-2.5 flex-wrap mt-0.5">
                      {responsaveisEstudo.map(resp => (
                        <span key={resp.matriculaId + '-' + resp.nome} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-900 font-medium flex items-center gap-1">
                          {resp.nome}
                          {resp.papel && <span className="text-slate-400 font-normal text-[10px]">({resp.papel})</span>}
                          {resp.tipo === 'SUBSTITUTO' && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1 rounded uppercase scale-90">Substituto</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 mt-1">
                    Nenhum responsável vinculado na base oficial para este estudo dirigido.
                  </div>
                )}

                {estudoDirigidoHoje.motivo_substituicao && (
                  <div className="mt-1 text-[11px] text-purple-700 italic">
                    Motivo da substituição: {estudoDirigidoHoje.motivo_substituicao}
                  </div>
                )}
              </div>
            </div>

            {/* Controles Rápidos: Realizado, Parcial, Não realizado, Substituição */}
            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
              <button
                onClick={() =>
                  atualizarStatusEstudoDirigido(
                    estudoDirigidoHoje.leitura_id || estudoDirigidoHoje.data || '',
                    'REALIZADO'
                  )
                }
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  estudoDirigidoHoje.status_realizacao === 'REALIZADO'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                }`}
              >
                ✓ Realizado
              </button>

              <button
                onClick={() =>
                  atualizarStatusEstudoDirigido(
                    estudoDirigidoHoje.leitura_id || estudoDirigidoHoje.data || '',
                    'PARCIAL'
                  )
                }
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  estudoDirigidoHoje.status_realizacao === 'PARCIAL'
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-900'
                }`}
              >
                Parcial
              </button>

              <button
                onClick={() =>
                  atualizarStatusEstudoDirigido(
                    estudoDirigidoHoje.leitura_id || estudoDirigidoHoje.data || '',
                    'NAO_REALIZADO'
                  )
                }
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  estudoDirigidoHoje.status_realizacao === 'NAO_REALIZADO'
                    ? 'bg-red-700 text-white'
                    : 'bg-red-100 hover:bg-red-200 text-red-900'
                }`}
              >
                Não realizado
              </button>

              <button
                onClick={() => setModoSubstituicao(!modoSubstituicao)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                  estudoDirigidoHoje.status_realizacao === 'SUBSTITUICAO'
                    ? 'bg-purple-700 text-white border-purple-800'
                    : 'bg-white hover:bg-purple-50 text-purple-900 border-purple-200'
                }`}
              >
                Substituição
              </button>
            </div>
          </div>

          {/* Inline Quick Selector de Substituição */}
          {modoSubstituicao && (
            <div className="mt-2.5 pt-2 border-t border-amber-200 flex flex-wrap items-center gap-2 text-xs bg-amber-100/50 p-2 rounded-lg">
              <span className="font-semibold text-slate-800">Quem apresentou no lugar?</span>
              <select
                value={alunoSubstitutoId}
                onChange={e => setAlunoSubstitutoId(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 bg-white text-xs text-slate-800"
              >
                <option value="">Selecione o estudante que apresentou...</option>
                {alunosLista.map(item => (
                  <option key={item.matricula.matricula_id} value={item.matricula.matricula_id}>
                    {item.aluno.nome} ({item.aluno.identificador_academico})
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={motivoSubstituicao}
                onChange={e => setMotivoSubstituicao(e.target.value)}
                placeholder="Motivo da substituição (opcional)..."
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 flex-1 min-w-[180px]"
              />

              <button
                onClick={() => {
                  if (alunoSubstitutoId) {
                    const subMat = alunosLista.find(a => a.matricula.matricula_id === alunoSubstitutoId);
                    const subNome = subMat ? subMat.aluno.nome : 'Colega';
                    atualizarStatusEstudoDirigido(
                      estudoDirigidoHoje.leitura_id || estudoDirigidoHoje.data || '',
                      'SUBSTITUICAO',
                      [alunoSubstitutoId],
                      `Apresentado por ${subNome}${motivoSubstituicao ? ` (${motivoSubstituicao})` : ''}`
                    );
                    setModoSubstituicao(false);
                  }
                }}
                disabled={!alunoSubstitutoId}
                className="px-3 py-1 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded font-semibold text-xs cursor-pointer"
              >
                Salvar Substituição
              </button>
              <button
                onClick={() => setModoSubstituicao(false)}
                className="text-slate-500 hover:text-slate-800 text-xs underline cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}
        </section>
      )}

      {/* ALERTA DE TOKEN OAUTH EXPIRADO DURANTE A SUPERVISÃO */}
      {isTokenExpired && (
        <div className="bg-amber-600 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-200" />
            <span>Sessão do Google expirada durante a supervisão. Nenhum dado foi perdido (estão preservados localmente).</span>
          </div>
          <button
            onClick={() => reconectarESincronizar()}
            className="px-3.5 py-1.5 rounded-lg bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
          >
            Reconectar e Sincronizar
          </button>
        </div>
      )}

      {/* FEEDBACK DE CHAMADA SALVA */}
      {chamadaSalvaMsg && (
        <div
          className={`text-white text-xs px-4 py-2.5 flex items-center justify-between shadow-xs shrink-0 ${
            chamadaSalvaMsg.tipo === 'remoto' ? 'bg-emerald-600' : 'bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {chamadaSalvaMsg.tipo === 'remoto' ? (
              <Check className="w-4 h-4 text-emerald-200" />
            ) : (
              <Clock className="w-4 h-4 text-amber-300" />
            )}
            <span className="font-semibold">{chamadaSalvaMsg.texto}</span>
          </div>
          <div className="flex items-center gap-2">
            {chamadaSalvaMsg.tokenExpirado && (
              <button
                onClick={() => reconectarESincronizar()}
                className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 cursor-pointer text-[11px]"
              >
                Reconectar Agora
              </button>
            )}
            <button onClick={() => setChamadaSalvaMsg(null)} className="text-white hover:opacity-80">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SELETOR MOBILE: CHAMADA VS FICHA DO ALUNO */}
      <div className="flex md:hidden bg-slate-200 p-1 border-b border-slate-300 shrink-0">
        <button
          onClick={() => setMobileTab('LISTA')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'LISTA'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>Chamada ({alunosLista.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('DETALHE')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'DETALHE'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span>Ficha do Aluno</span>
        </button>
      </div>

      {/* 3. MAIN SPLIT SCREEN: LISTA DE ALUNOS COM CHAMADA POR EXCEÇÃO (35%) / DETALHES DO ALUNO (65%) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* COLUNA ESQUERDA: CHAMADA POR EXCEÇÃO + LISTA RÁPIDA (Tablet 35%) */}
        <div className={`w-full md:w-[380px] lg:w-[420px] bg-white border-r border-slate-200 flex-col shrink-0 overflow-hidden ${mobileTab === 'DETALHE' ? 'hidden md:flex' : 'flex'}`}>
          {/* HEADER DA CHAMADA: RESUMO E BOTÃO DE SALVAMENTO */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-900 text-xs">Chamada por Exceção</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                <span className="text-emerald-700 font-semibold">{presentesCount} presentes</span> ·{' '}
                <span className={faltasCount > 0 ? 'text-red-700 font-semibold' : 'text-slate-400'}>
                  {faltasCount} falta(s)
                </span>
                {atrasosCount > 0 && ` · ${atrasosCount} atraso`}
                {celularCount > 0 && ` · ${celularCount} celular`}
              </p>
            </div>

            <button
              onClick={handleSalvarChamada}
              disabled={saveStatus === 'SALVANDO'}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Gravar chamada da aula com as exceções marcadas"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Chamada</span>
            </button>
          </div>

          {/* BUSCA RÁPIDA DE ALUNO */}
          <div className="p-2.5 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar aluno na turma..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* LISTA COMPACTA COM CONTROLES RÁPIDOS POR EXCEÇÃO: [Faltou] [Atraso] [Celular] [+] */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredAlunos.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum aluno encontrado nesta turma.
              </div>
            ) : (
              filteredAlunos.map(item => {
                const matId = item.matricula.matricula_id;
                const isSelected = matId === selectedMatriculaId;
                const exc = excecoes[matId] || { faltou: false, atraso: false, celular: false };
                const resumo = getResumoAlunoSupervisao(matId);
                const hasAlert = resumo?.temAtencao;

                return (
                  <div
                    key={matId}
                    className={`p-2.5 flex items-center justify-between gap-2 transition-colors select-none ${
                      isSelected ? 'bg-slate-100 border-l-4 border-slate-900' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Aluno Nome + Indicador */}
                    <button
                      onClick={() => {
                        setSelectedMatriculaId(matId);
                        setMobileTab('DETALHE');
                      }}
                      className="text-left flex-1 min-w-0 cursor-pointer pr-1 py-1"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`text-xs font-semibold truncate ${
                            exc.faltou ? 'line-through text-red-700' : 'text-slate-900'
                          }`}
                        >
                          {item.aluno.nome}
                        </span>
                        {hasAlert && (
                          <span
                            className="text-amber-500 font-bold text-xs shrink-0 cursor-help"
                            title={`${resumo?.motivosAtencao.length || 0} pendências:\n${resumo?.motivosAtencao.map(m => `· ${m}`).join('\n') || ''}`}
                          >
                            ⚠
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {item.aluno.identificador_academico}
                        {exc.justificativa && (
                          <span className="text-blue-600 ml-1">· Justificada</span>
                        )}
                        {exc.observacao && (
                          <span className="text-slate-500 ml-1">· Obs: {exc.observacao}</span>
                        )}
                      </div>
                    </button>

                    {/* CONTROLES RÁPIDOS DE EXCEÇÃO: [Faltou] [Atraso] [Celular] [+] (Áreas mínimas de 44px) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* [Faltou] */}
                      <button
                        onClick={() => toggleFaltou(matId)}
                        className={`min-h-[44px] min-w-[52px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                          exc.faltou
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700'
                        }`}
                        title="Marcar falta para este aluno"
                      >
                        {exc.faltou ? 'FALTA' : 'Faltou'}
                      </button>

                      {/* [Atraso] */}
                      <button
                        onClick={() => toggleAtraso(matId)}
                        className={`min-h-[44px] min-w-[44px] p-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center ${
                          exc.atraso
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-700'
                        }`}
                        title="Registrar atraso"
                      >
                        <Clock className="w-4 h-4" />
                      </button>

                      {/* [Celular] */}
                      <button
                        onClick={() => toggleCelular(matId)}
                        className={`min-h-[44px] min-w-[44px] p-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center ${
                          exc.celular
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-700'
                        }`}
                        title="Registrar uso de smartphone durante aula"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>

                      {/* [+] Mais opções: justificativa, observação */}
                      <button
                        onClick={() => {
                          setMatriculaParaMais(matId);
                          setModalType('maisExcecao');
                        }}
                        className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer flex items-center justify-center"
                        title="Adicionar justificativa ou observação"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: FICHA RESUMIDA DO ALUNO SELECIONADO (65%) */}
        <div className={`flex-1 bg-slate-50 overflow-y-auto p-4 md:p-6 space-y-4 ${mobileTab === 'LISTA' ? 'hidden md:block' : 'block'}`}>
          {!resumoAluno ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Selecione um aluno na coluna à esquerda para visualizar sua ficha e registrar orientações.
            </div>
          ) : (
            <div className="max-w-4xl space-y-4">
              {/* CABEÇALHO DO ALUNO */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      {resumoAluno.aluno.nome}
                    </h3>
                    <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {resumoAluno.aluno.identificador_academico}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {resumoAluno.turma.nome} · {resumoAluno.disciplina.nome}
                  </p>
                </div>

                <button
                  onClick={() => onOpenFichaAluno(resumoAluno.matricula.matricula_id, 'resumo')}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <span>Abrir Ficha Completa</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* RESUMO COMPACTO DE INDICADORES */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <div className="text-[11px] text-slate-500">Registros Semanais (RSS)</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {resumoAluno.totalRegistrosEntregues}
                    <span className="text-slate-400 font-normal"> de </span>
                    {resumoAluno.totalRegistrosEsperados}
                    <span className="text-[11px] text-slate-400 font-normal"> esperados</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
                    <span className="text-emerald-600 font-semibold">
                      {resumoAluno.totalRegistrosEntregues >= resumoAluno.totalRegistrosEsperados ? 'Em dia' : 'Atrasado'}
                    </span>
                    <span>{resumoAluno.totalPrevistoNoPeriodo ?? 12} no semestre</span>
                  </div>
                </div>

                <div
                  className={`p-3 bg-white border rounded-xl shadow-xs ${
                    resumoAluno.faltasInjustificadasCount > 0
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-500">Faltas no Semestre</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {resumoAluno.faltasInjustificadasCount}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {resumoAluno.faltasInjustificadasCount > 0 ? '⚠ Injustificada' : 'Sem faltas graves'}
                  </div>
                </div>

                <div
                  className={`p-3 bg-white border rounded-xl shadow-xs ${
                    resumoAluno.docsPendentesCount > 0
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-500">Documentação</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {resumoAluno.docsPendentesCount === 0
                      ? 'Regular'
                      : `${resumoAluno.docsPendentesCount} pend.`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {resumoAluno.docsPendentesCount > 0 ? 'TCLE / Termo' : 'Tudo entregue'}
                  </div>
                </div>

                <div
                  className={`p-3 bg-white border rounded-xl shadow-xs ${
                    resumoAluno.orientacoesAbertasCount > 0
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-500">Orientações Abertas</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {resumoAluno.orientacoesAbertasCount}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {resumoAluno.orientacoesAbertasCount > 0 ? 'Aguardando retorno' : 'Resolvidas'}
                  </div>
                </div>
              </div>

              {/* PONTOS FORMATIVOS ATIVOS */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-900">
                      Pontos de Acompanhamento Formativo
                    </span>
                  </div>
                  <button
                    onClick={() => setModalType('ponto')}
                    className="text-xs text-slate-700 hover:text-slate-950 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Ponto</span>
                  </button>
                </div>

                {resumoAluno.pontosAtivos.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    Nenhum ponto formativo em aberto para este estudante.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resumoAluno.pontosAtivos.map(ponto => (
                      <div
                        key={ponto.ponto_id}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => togglePontoStatus(ponto.ponto_id)}
                            className="mt-0.5 w-4 h-4 rounded border border-slate-300 hover:border-slate-500 bg-white flex items-center justify-center cursor-pointer"
                            title="Concluir ponto formativo"
                          >
                            {ponto.status === 'CONCLUIDO' && (
                              <Check className="w-3 h-3 text-emerald-600" />
                            )}
                          </button>
                          <div>
                            <span className="text-slate-800 font-medium leading-relaxed">
                              {ponto.texto}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Criado em {ponto.data_criacao}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => togglePontoStatus(ponto.ponto_id)}
                          className="text-[11px] text-slate-600 hover:text-emerald-700 font-medium cursor-pointer"
                        >
                          Concluir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ÚLTIMAS ORIENTAÇÕES CLÍNICAS */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Últimas Orientações da Supervisão
                  </span>
                  <button
                    onClick={() => setModalType('orientacao')}
                    className="text-xs text-slate-700 hover:text-slate-950 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Orientação</span>
                  </button>
                </div>

                {resumoAluno.ultimasOrientacoes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    Nenhuma orientação registrada para este estudante ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resumoAluno.ultimasOrientacoes.map(ori => {
                      const isAberta = ori.status === 'ABERTA';
                      return (
                        <div
                          key={ori.orientacao_id}
                          className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{ori.categoria}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  isAberta
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isAberta ? 'Aberta' : 'Concluída'}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed">{ori.texto}</p>
                          </div>
                          <button
                            onClick={() => toggleOrientacaoStatus(ori.orientacao_id)}
                            className="text-[11px] text-slate-500 hover:text-slate-900 font-medium underline cursor-pointer"
                          >
                            {isAberta ? 'Concluir' : 'Reabrir'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AÇÕES RÁPIDAS FORMATIVAS EM SALA */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                  Ações Rápidas Durante o Atendimento
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    onClick={() => setModalType('orientacao')}
                    className="p-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Orientação</span>
                  </button>

                  <button
                    onClick={() => setModalType('feedback')}
                    className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-600" />
                    <span>+ Feedback</span>
                  </button>

                  <button
                    onClick={() => setModalType('ponto')}
                    className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-600" />
                    <span>+ Ponto Formativo</span>
                  </button>

                  <button
                    onClick={() => setModalType('ocorrencia')}
                    className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Ocorrência</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: MARCAR AULA COMO NÃO REALIZADA */}
      {modalType === 'naoRealizada' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Marcar Aula como Não Realizada
                </h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Esta ação registra que o encontro da turma <strong>{turma?.nome}</strong> em{' '}
              <strong>{hojeIso}</strong> não aconteceu. <strong>NÃO</strong> gerará falta para os
              estudantes nem chamada pendente.
            </p>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Motivo do Encontro Não Ocorrido</label>
                <select
                  value={motivoNaoRealizada}
                  onChange={e => setMotivoNaoRealizada(e.target.value as MotivoNaoRealizado)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-xs font-semibold text-slate-800"
                >
                  <option value="Feriado">Feriado</option>
                  <option value="Recesso acadêmico">Recesso acadêmico</option>
                  <option value="Cancelamento institucional">Cancelamento institucional</option>
                  <option value="Cancelamento da professora">Cancelamento da professora</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Observação (Opcional)</label>
                <input
                  type="text"
                  value={obsNaoRealizada}
                  onChange={e => setObsNaoRealizada(e.target.value)}
                  placeholder="Ex: Feriado da Proclamação da República"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await marcarEncontroNaoRealizado(
                    turmaId,
                    hojeIso,
                    motivoNaoRealizada,
                    obsNaoRealizada
                  );
                  setModalType(null);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer"
              >
                Confirmar Aula Não Realizada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REAGENDAR AULA */}
      {modalType === 'reagendar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Reagendar Supervisão</h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              A data original ({hojeIso}) será preservada no histórico e não gerará faltas nem chamada
              pendente. A nova data assumirá o encontro ativo.
            </p>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nova Data do Encontro</label>
                <input
                  type="date"
                  required
                  value={novaDataReagendada}
                  onChange={e => setNovaDataReagendada(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 bg-slate-50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Novo Horário (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: 08:30–11:00 (deixar em branco para manter)"
                  value={novoHorarioReagendado}
                  onChange={e => setNovoHorarioReagendado(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Motivo do Reagendamento</label>
                <input
                  type="text"
                  placeholder="Ex: Reposição de feriado acadêmico"
                  value={motivoReagendamento}
                  onChange={e => setMotivoReagendamento(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={transferirEstudoCheck}
                  onChange={e => setTransferirEstudoCheck(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Transferir estudo dirigido e leitores previstos para a nova data</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (novaDataReagendada) {
                    await reagendarEncontro(
                      turmaId,
                      hojeIso,
                      novaDataReagendada,
                      novoHorarioReagendado,
                      motivoReagendamento,
                      transferirEstudoCheck
                    );
                    setModalType(null);
                  }
                }}
                disabled={!novaDataReagendada}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-bold cursor-pointer"
              >
                Confirmar Reagendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MAIS EXCEÇÃO (+ Observação / Justificativa na Chamada) */}
      {modalType === 'maisExcecao' && matriculaParaMais && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Anotações de Chamada —{' '}
                {alunosLista.find(a => a.matricula.matricula_id === matriculaParaMais)?.aluno.nome}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Justificativa de Falta (se houver atestado ou comunicação prévia)
                </label>
                <textarea
                  rows={2}
                  value={excecoes[matriculaParaMais]?.justificativa || ''}
                  onChange={e =>
                    setExcecoes(prev => ({
                      ...prev,
                      [matriculaParaMais]: {
                        ...(prev[matriculaParaMais] || { faltou: true, atraso: false, celular: false }),
                        justificativa: e.target.value,
                      },
                    }))
                  }
                  placeholder="Ex: Atestado médico de 24h enviado por e-mail..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Observação Pontual da Chamada
                </label>
                <input
                  type="text"
                  value={excecoes[matriculaParaMais]?.observacao || ''}
                  onChange={e =>
                    setExcecoes(prev => ({
                      ...prev,
                      [matriculaParaMais]: {
                        ...(prev[matriculaParaMais] || { faltou: false, atraso: false, celular: false }),
                        observacao: e.target.value,
                      },
                    }))
                  }
                  placeholder="Ex: Saiu 20min mais cedo para atendimento externo..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
              >
                Pronto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS DA FICHA: ORIENTAÇÃO, FEEDBACK, PONTO */}
      {modalType === 'orientacao' && (
        <ModalNovaOrientacao
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'feedback' && (
        <ModalNovoFeedback
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'ponto' && (
        <ModalNovoPontoAcompanhamento
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'ocorrencia' && (
        <ModalRegistrarOcorrencia
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          tipoInicial="USO_INADEQUADO_DISPOSITIVO"
          onClose={() => setModalType(null)}
        />
      )}
    </div>
  );
};
