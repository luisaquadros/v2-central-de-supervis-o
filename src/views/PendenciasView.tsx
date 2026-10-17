import React, { useState } from 'react';
import {
  AlertCircle,
  FileCheck,
  CalendarCheck,
  Clock,
  Filter,
  ChevronRight,
  CheckCircle2,
  Inbox,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { documentosPendentesOficiais } from '../services/documentacaoAcademicaService';
import { ControleCobrancaDocumento } from '../components/ControleCobrancaDocumento';

interface PendenciasViewProps {
  initialFilterType?: string;
  onOpenAluno: (matriculaId: string, initialTab?: string) => void;
  onOpenCaixaPendente?: () => void;
}

export const PendenciasView: React.FC<PendenciasViewProps> = ({
  initialFilterType,
  onOpenAluno,
  onOpenCaixaPendente,
}) => {
  const {
    selectedPeriodoId,
    turmas,
    matriculas,
    alunos,
    orientacoes,
    documentos,
    entregas,
    registrosSemanais,
    statusRssUnidades,
    getStatusRssUnidade,
    getSituacaoRssEstudante,
    getPendenciasCanonicas,
    marcarPendenciaResolvida,
    frequencias,
    caixaEntrada,
  } = useSupervisao();

  const [categoriaAtiva, setCategoriaAtiva] = useState<'OBJETIVA' | 'ATENCAO' | 'CAIXA_ENTRADA' | 'INCONSISTENCIA'>(() => {
    if (initialFilterType === 'ATENCAO' || initialFilterType === 'orientacoes' || initialFilterType === 'faltas') return 'ATENCAO';
    if (initialFilterType === 'CAIXA_ENTRADA' || initialFilterType === 'caixa') return 'CAIXA_ENTRADA';
    if (initialFilterType === 'INCONSISTENCIA') return 'INCONSISTENCIA';
    return 'OBJETIVA';
  });
  const filtroEhTurma = (v?: string) => !!v && !['ATENCAO','orientacoes','faltas','CAIXA_ENTRADA','caixa','INCONSISTENCIA','OBJETIVA'].includes(v);
  const [turmaFiltro, setTurmaFiltro] = useState<string>(() => filtroEhTurma(initialFilterType) ? initialFilterType! : 'TODAS');
  React.useEffect(() => { if (filtroEhTurma(initialFilterType)) setTurmaFiltro(initialFilterType!); }, [initialFilterType]);
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);
  const [mostrarTodas, setMostrarTodas] = useState(true);

  const documentosAConferir = documentosPendentesOficiais(entregas, documentos);
  const todasPendenciasCanonicas = getPendenciasCanonicas().filter(p => {
    if (turmaFiltro === 'TODAS') return true;
    return p.turma_id === turmaFiltro;
  });

  // Resumo por turma/tópico. Somente itens canônicos; ausência de RSS não é ausência comprovada.
  const resumoPorTurma = new Map<string, {nome:string; contagem:Map<string,number>; total:number}>();
  for (const p of todasPendenciasCanonicas) {
    const k = p.turma_id || 'GERAL';
    if (!resumoPorTurma.has(k)) resumoPorTurma.set(k, {nome:p.turma_nome || 'Geral',contagem:new Map(),total:0});
    const g = resumoPorTurma.get(k)!; g.total++;
    g.contagem.set(p.tipo,(g.contagem.get(p.tipo)||0)+1);
  }

  // A. PENDÊNCIAS OBJETIVAS (Algo faltando/atrasado de fato)
  const pendenciasObjetivas = todasPendenciasCanonicas
    .filter(p => p.tipo === 'DOCUMENTO' || p.tipo === 'RSS_ATRASADO' || p.tipo === 'PRAZO')
    .map(p => {
      const mat = matriculas.find(m => m.matricula_id === p.matricula_id);
      const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
      return {
        id: p.id,
        tipo: p.tipo === 'DOCUMENTO' ? 'Documentação Pendente' : p.tipo === 'RSS_ATRASADO' ? 'RSS em Atraso' : 'Prazos Vencidos',
        alunoNome: p.aluno_nome || 'Estudante',
        alunoRa: al ? al.identificador_academico : '',
        turmaNome: p.turma_nome || '',
        matriculaId: p.matricula_id || '',
        titulo: p.titulo,
        detalhe: p.descricao,
      };
    });

  // B. PONTOS DE ATENÇÃO (Acompanhamento pedagógico)
  const pontosDeAtencao = todasPendenciasCanonicas
    .filter(p => p.tipo === 'FALTA_INJUSTIFICADA' || p.tipo === 'ORIENTACAO' || p.tipo === 'JUSTIFICATIVA' || p.tipo === 'CHAMADA')
    .map(p => {
      const mat = matriculas.find(m => m.matricula_id === p.matricula_id);
      const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
      return {
        id: p.id,
        tipo: p.tipo === 'FALTA_INJUSTIFICADA' ? 'Falta Injustificada' : p.tipo === 'ORIENTACAO' ? 'Orientação em Aberto' : p.tipo === 'JUSTIFICATIVA' ? 'Justificativa Pendente' : 'Chamada Pendente',
        alunoNome: p.aluno_nome || (p.tipo === 'CHAMADA' ? 'Turma' : 'Estudante'),
        alunoRa: al ? al.identificador_academico : '',
        turmaNome: p.turma_nome || '',
        matriculaId: p.matricula_id || '',
        titulo: p.titulo,
        detalhe: p.descricao,
      };
    });

  // C. CAIXA DE ENTRADA PENDENTE
  const itensCaixaPendente = caixaEntrada.filter((i: any) => i.status === 'PENDENTE');

  // D. INCONSISTÊNCIAS DE INTEGRAÇÃO/DADOS
  const inconsistencias: {
    id: string;
    titulo: string;
    detalhe: string;
  }[] = [];

  matriculas.forEach(m => {
    if (!alunos.some(a => a.aluno_id === m.aluno_id)) {
      inconsistencias.push({
        id: `inc-mat-${m.matricula_id}`,
        titulo: `Matrícula órfã (${m.matricula_id})`,
        detalhe: `A matrícula não possui registro correspondente na tabela alunos.`,
      });
    }
  });

  // Garante que o usuário veja a categoria com pendências imediatamente caso OBJETIVA esteja zerada
  const categoriaEfetiva = React.useMemo(() => {
    if (categoriaAtiva === 'OBJETIVA' && pendenciasObjetivas.length === 0) {
      if (pontosDeAtencao.length > 0) return 'ATENCAO';
      if (itensCaixaPendente.length > 0) return 'CAIXA_ENTRADA';
      if (inconsistencias.length > 0) return 'INCONSISTENCIA';
    }
    return categoriaAtiva;
  }, [categoriaAtiva, pendenciasObjetivas.length, pontosDeAtencao.length, itensCaixaPendente.length, inconsistencias.length]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Central Única de Pendências
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Triagem & Gestão de Pendências
          </h1>
          <p className="text-xs text-slate-500">
            Separação conceitual entre pendências objetivas, pontos de atenção e caixa de entrada
          </p>
        </div>

        {/* Filter by Turma */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Filtrar por Turma</label>
          <select
            value={turmaFiltro}
            onChange={e => setTurmaFiltro(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
          >
            <option value="TODAS">Todas as Turmas Ativas</option>
            {turmas.map(t => (
              <option key={t.turma_id} value={t.turma_id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3" aria-label="Resumo das pendências por turma">
        <h2 className="text-base font-bold text-slate-900">Pendências por turma e tópico</h2>
        <p className="text-xs text-slate-600">Toque na turma para conferir itens e responsáveis. Não pressupõe ausência de RSS quando o documento não foi identificado.</p>
        {resumoPorTurma.size === 0 ? <p className="text-sm text-slate-600">Nenhuma pendência canônica nesta seleção.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...resumoPorTurma.entries()].map(([id,g]) => <button type="button" key={id} onClick={() => { setTurmaFiltro(id === 'GERAL' ? 'TODAS' : id); setMostrarTodas(true); }}
            className="text-left bg-slate-50 border border-slate-200 hover:border-teal-500 rounded-xl p-3">
            <div className="flex justify-between gap-2 items-center"><strong className="text-sm text-slate-900">{g.nome}</strong><strong className="text-sm text-amber-800">{g.total}</strong></div>
            <div className="mt-2 flex flex-wrap gap-1">{[...g.contagem.entries()].map(([tipo,q]) => <span key={tipo} className="rounded bg-white border border-slate-200 px-2 py-1 text-xs text-slate-700">{tipo.replaceAll('_',' ').toLowerCase()}: {q}</span>)}</div>
            <span className="mt-2 block text-xs font-semibold text-teal-800">Ver detalhes da turma →</span>
          </button>)}
        </div>}
      </section>
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3" aria-label="Todas as pendências abertas">
        <div className="flex justify-between flex-wrap items-center gap-2"><h2 className="text-base font-bold text-slate-900">Todas as pendências abertas ({todasPendenciasCanonicas.length})</h2><button type="button" onClick={() => setMostrarTodas(v => !v)} className="text-xs underline text-teal-800">{mostrarTodas?'Recolher detalhes':'Expandir detalhes'}</button></div>
        <p className="text-xs text-slate-600">A lista reúne chamadas, RSS, documentação, prazos e orientações. Marcar como resolvida registra sua confirmação, mas não substitui a atualização do registro acadêmico correspondente.</p>
        {todasPendenciasCanonicas.length === 0 ? <p className="text-sm text-slate-500">Nenhuma pendência aberta nesta seleção.</p> : !mostrarTodas ? <p className="text-sm text-slate-600">Expanda para ver itens individualmente.</p> :
          <div className="space-y-2">
            {todasPendenciasCanonicas.map(item => <div key={item.id} className="border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.titulo}</p>
                <p className="text-xs text-slate-600 mt-1">{item.turma_nome || 'Geral'} · {item.descricao}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-700"><span className="rounded bg-slate-100 px-2 py-1">Tipo: {item.tipo.replaceAll('_',' ')}</span>
                  {item.aluno_nome && <span className="rounded bg-slate-100 px-2 py-1">Estudante: {item.aluno_nome}</span>}
                  {item.matricula_id && <span className="rounded bg-slate-100 px-2 py-1">Ficha individual disponível</span>}</div>
                {item.tipo === 'DOCUMENTO' && item.matricula_id && documentosAConferir.find(d => 'pend-doc-' + d.documento_id === item.id) && <ControleCobrancaDocumento
                   matriculaId={item.matricula_id} nome={item.aluno_nome || 'Estudante'}
                   tipo={documentosAConferir.find(d => 'pend-doc-' + d.documento_id === item.id)!.tipo}/>}
              </div>
              <div className="flex gap-2 shrink-0">
                {item.matricula_id && <button type="button" onClick={() => onOpenAluno(item.matricula_id!)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg">Abrir ficha</button>}
                <button type="button" disabled={resolvendoId === item.id} onClick={async () => {
                  if (!window.confirm('Confirmar que esta pendência foi resolvida? Isso registra uma resolução administrativa, sem alterar a chamada, o RSS ou a documentação original.')) return;
                  setResolvendoId(item.id);
                  try { await marcarPendenciaResolvida(item); }
                  catch { window.alert('Não foi possível salvar a resolução. Verifique a sincronização.'); }
                  finally { setResolvendoId(null); }
                }} className="min-h-[44px] px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50">Pendência resolvida</button>
              </div>
            </div>)}
          </div>
        }
      </section>

      {/* 4 Categorias Conceituais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setCategoriaAtiva('OBJETIVA')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            categoriaEfetiva === 'OBJETIVA'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase">A. Objetiva</span>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-xl font-black">{pendenciasObjetivas.length}</span>
          <span className={`text-[11px] mt-1 ${categoriaEfetiva === 'OBJETIVA' ? 'text-slate-300' : 'text-slate-400'}`}>
            Faltando / Atrasado
          </span>
        </button>

        <button
          onClick={() => setCategoriaAtiva('ATENCAO')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            categoriaEfetiva === 'ATENCAO'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase">B. Ponto de Atenção</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl font-black">{pontosDeAtencao.length}</span>
          <span className={`text-[11px] mt-1 ${categoriaEfetiva === 'ATENCAO' ? 'text-slate-300' : 'text-slate-400'}`}>
            Acompanhamento
          </span>
        </button>

        <button
          onClick={() => setCategoriaAtiva('CAIXA_ENTRADA')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            categoriaEfetiva === 'CAIXA_ENTRADA'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase">C. Caixa de Entrada</span>
            <Inbox className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-xl font-black">{itensCaixaPendente.length}</span>
          <span className={`text-[11px] mt-1 ${categoriaEfetiva === 'CAIXA_ENTRADA' ? 'text-slate-300' : 'text-slate-400'}`}>
            Não Classificados
          </span>
        </button>

        <button
          onClick={() => setCategoriaAtiva('INCONSISTENCIA')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            categoriaEfetiva === 'INCONSISTENCIA'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase">D. Inconsistência</span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xl font-black">{inconsistencias.length}</span>
          <span className={`text-[11px] mt-1 ${categoriaEfetiva === 'INCONSISTENCIA' ? 'text-slate-300' : 'text-slate-400'}`}>
            Auditoria / Base
          </span>
        </button>
      </div>

      {/* List Content */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        {/* A. Pendência Objetiva */}
        {categoriaEfetiva === 'OBJETIVA' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pendências Objetivas ({pendenciasObjetivas.length})
            </h2>
            {pendenciasObjetivas.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhuma pendência documental ou de RSS atrasado encontrada.
              </div>
            ) : (
              pendenciasObjetivas.map(p => (
                <div
                  key={p.id}
                  onClick={() => onOpenAluno(p.matriculaId)}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                        {p.tipo}
                      </span>
                      <strong className="text-xs text-slate-900">{p.alunoNome}</strong>
                      <span className="text-[11px] text-slate-400 font-mono">{p.turmaNome}</span>
                    </div>
                    <div className="text-xs text-slate-700 font-semibold mt-1">{p.titulo}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{p.detalhe}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-700 transition-colors" />
                </div>
              ))
            )}
          </div>
        )}

        {/* B. Ponto de Atenção */}
        {categoriaEfetiva === 'ATENCAO' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pontos de Atenção Pedagógica ({pontosDeAtencao.length})
            </h2>
            {pontosDeAtencao.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum ponto de atenção em aberto no momento.
              </div>
            ) : (
              pontosDeAtencao.map(p => (
                <div
                  key={p.id}
                  onClick={() => onOpenAluno(p.matriculaId)}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {p.tipo}
                      </span>
                      <strong className="text-xs text-slate-900">{p.alunoNome}</strong>
                      <span className="text-[11px] text-slate-400 font-mono">{p.turmaNome}</span>
                    </div>
                    <div className="text-xs text-slate-700 font-semibold mt-1">{p.titulo}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{p.detalhe}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-700 transition-colors" />
                </div>
              ))
            )}
          </div>
        )}

        {/* C. Caixa de Entrada Pendente */}
        {categoriaEfetiva === 'CAIXA_ENTRADA' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Itens na Caixa de Entrada Aguardando Resolução ({itensCaixaPendente.length})
              </h2>
              {onOpenCaixaPendente && (
                <button
                  onClick={onOpenCaixaPendente}
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Abrir Caixa de Entrada Completa →
                </button>
              )}
            </div>

            {itensCaixaPendente.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhuma entrada rápida pendente de classificação.
              </div>
            ) : (
              itensCaixaPendente.map((item: any) => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      {item.tipo_sugerido || 'Anotação'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.criado_em}</span>
                  </div>
                  <p className="text-xs text-slate-800 font-medium pt-1">"{item.texto_original}"</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* D. Inconsistência de Dados */}
        {categoriaEfetiva === 'INCONSISTENCIA' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Inconsistências Identificadas na Base ({inconsistencias.length})
            </h2>
            {inconsistencias.length === 0 ? (
              <div className="py-8 text-center text-emerald-600 text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Base íntegra! Nenhuma anomalia de chave estrangeira ou registro órfão detectada.</span>
              </div>
            ) : (
              inconsistencias.map(inc => (
                <div key={inc.id} className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 space-y-1">
                  <strong className="text-xs text-purple-950 block">{inc.titulo}</strong>
                  <p className="text-xs text-purple-800">{inc.detalhe}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
