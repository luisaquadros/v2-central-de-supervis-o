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
    registrosSemanais,
    statusRssUnidades,
    getStatusRssUnidade,
    frequencias,
    caixaEntrada,
  } = useSupervisao();

  const [categoriaAtiva, setCategoriaAtiva] = useState<'OBJETIVA' | 'ATENCAO' | 'CAIXA_ENTRADA' | 'INCONSISTENCIA'>('OBJETIVA');
  const [turmaFiltro, setTurmaFiltro] = useState<string>('TODAS');

  const turmasIds = turmas.map(t => t.turma_id);
  const matriculasDoPeriodo = matriculas.filter(
    m => (turmaFiltro === 'TODAS' || m.turma_id === turmaFiltro) && turmasIds.includes(m.turma_id)
  );

  // A. PENDÊNCIAS OBJETIVAS (Algo faltando/atrasado de fato)
  const pendenciasObjetivas: {
    id: string;
    tipo: string;
    alunoNome: string;
    alunoRa: string;
    turmaNome: string;
    matriculaId: string;
    titulo: string;
    detalhe: string;
  }[] = [];

  // Documentos pendentes
  documentos
    .filter(d => d.status === 'PENDENTE')
    .forEach(d => {
      const mat = matriculas.find(m => m.matricula_id === d.matricula_id);
      if (!mat || (turmaFiltro !== 'TODAS' && mat.turma_id !== turmaFiltro)) return;
      const al = alunos.find(a => a.aluno_id === mat.aluno_id);
      const tur = turmas.find(t => t.turma_id === mat.turma_id);
      pendenciasObjetivas.push({
        id: d.documento_id,
        tipo: 'Documentação Pendente',
        alunoNome: al ? al.nome : 'Estudante',
        alunoRa: al ? al.identificador_academico : '',
        turmaNome: tur ? tur.nome : '',
        matriculaId: d.matricula_id,
        titulo: `Entrega pendente: ${d.tipo}`,
        detalhe: d.observacao || 'Documento obrigatório aguardando envio',
      });
    });

  // RSS de semanas encerradas em atraso (consumindo status da unidade da base oficial)
  matriculasDoPeriodo.forEach(m => {
    const rssMat = getStatusRssUnidade(m.turma_id, m.matricula_id);
    const entregas = registrosSemanais.filter(r => r.matricula_id === m.matricula_id && r.status === 'ENTREGUE').length;
    const esperado = rssMat?.total_esperado_ate_hoje !== undefined && rssMat?.total_esperado_ate_hoje !== null
      ? Number(rssMat.total_esperado_ate_hoje)
      : 0;

    const estaAtrasado = rssMat?.status_semanal === 'ATRASADO' || rssMat?.status_semanal === 'PENDENTE' || (esperado > 0 && esperado > entregas);

    if (estaAtrasado) {
      const al = alunos.find(a => a.aluno_id === m.aluno_id);
      const tur = turmas.find(t => t.turma_id === m.turma_id);
      pendenciasObjetivas.push({
        id: `rss-${m.matricula_id}`,
        tipo: 'RSS em Atraso',
        alunoNome: al ? al.nome : 'Estudante',
        alunoRa: al ? al.identificador_academico : '',
        turmaNome: tur ? tur.nome : '',
        matriculaId: m.matricula_id,
        titulo: `RSS: ${rssMat?.status_semanal || 'Pendente'}`,
        detalhe: `${entregas} entregas registradas${esperado > 0 ? ` de ${esperado} esperadas até o momento` : ''}`,
      });
    }
  });

  // B. PONTOS DE ATENÇÃO (Acompanhamento pedagógico)
  const pontosDeAtencao: {
    id: string;
    tipo: string;
    alunoNome: string;
    alunoRa: string;
    turmaNome: string;
    matriculaId: string;
    titulo: string;
    detalhe: string;
  }[] = [];

  // Faltas sem justificativa
  frequencias
    .filter(f => f.status === 'FALTA_SEM_JUSTIFICATIVA')
    .forEach(f => {
      const mat = matriculas.find(m => m.matricula_id === f.matricula_id);
      if (!mat || (turmaFiltro !== 'TODAS' && mat.turma_id !== turmaFiltro)) return;
      const al = alunos.find(a => a.aluno_id === mat.aluno_id);
      const tur = turmas.find(t => t.turma_id === mat.turma_id);
      pontosDeAtencao.push({
        id: f.frequencia_id,
        tipo: 'Falta Injustificada',
        alunoNome: al ? al.nome : 'Estudante',
        alunoRa: al ? al.identificador_academico : '',
        turmaNome: tur ? tur.nome : '',
        matriculaId: f.matricula_id,
        titulo: `Ausência sem justificativa em aula`,
        detalhe: `Data da aula: ${f.data_aula}`,
      });
    });

  // Orientações abertas
  orientacoes
    .filter(o => o.status === 'ABERTA')
    .forEach(o => {
      const mat = matriculas.find(m => m.matricula_id === o.matricula_id);
      if (!mat || (turmaFiltro !== 'TODAS' && mat.turma_id !== turmaFiltro)) return;
      const al = alunos.find(a => a.aluno_id === mat.aluno_id);
      const tur = turmas.find(t => t.turma_id === mat.turma_id);
      pontosDeAtencao.push({
        id: o.orientacao_id,
        tipo: 'Orientação em Aberto',
        alunoNome: al ? al.nome : 'Estudante',
        alunoRa: al ? al.identificador_academico : '',
        turmaNome: tur ? tur.nome : '',
        matriculaId: o.matricula_id,
        titulo: `Orientação pedagógica aguardando acompanhamento`,
        detalhe: `[${o.categoria}]: "${o.texto}"`,
      });
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

      {/* 4 Categorias Conceituais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setCategoriaAtiva('OBJETIVA')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            categoriaAtiva === 'OBJETIVA'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase">A. Objetiva</span>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-xl font-black">{pendenciasObjetivas.length}</span>
          <span className={`text-[11px] mt-1 ${categoriaAtiva === 'OBJETIVA' ? 'text-slate-300' : 'text-slate-400'}`}>
            Faltando / Atrasado
          </span>
        </button>

        <button
          onClick={() => setCategoriaAtiva('ATENCAO')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            categoriaAtiva === 'ATENCAO'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase">B. Ponto de Atenção</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl font-black">{pontosDeAtencao.length}</span>
          <span className={`text-[11px] mt-1 ${categoriaAtiva === 'ATENCAO' ? 'text-slate-300' : 'text-slate-400'}`}>
            Acompanhamento
          </span>
        </button>

        <button
          onClick={() => setCategoriaAtiva('CAIXA_ENTRADA')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            categoriaAtiva === 'CAIXA_ENTRADA'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase">C. Caixa de Entrada</span>
            <Inbox className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-xl font-black">{itensCaixaPendente.length}</span>
          <span className={`text-[11px] mt-1 ${categoriaAtiva === 'CAIXA_ENTRADA' ? 'text-slate-300' : 'text-slate-400'}`}>
            Não Classificados
          </span>
        </button>

        <button
          onClick={() => setCategoriaAtiva('INCONSISTENCIA')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            categoriaAtiva === 'INCONSISTENCIA'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase">D. Inconsistência</span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xl font-black">{inconsistencias.length}</span>
          <span className={`text-[11px] mt-1 ${categoriaAtiva === 'INCONSISTENCIA' ? 'text-slate-300' : 'text-slate-400'}`}>
            Auditoria / Base
          </span>
        </button>
      </div>

      {/* List Content */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        {/* A. Pendência Objetiva */}
        {categoriaAtiva === 'OBJETIVA' && (
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
        {categoriaAtiva === 'ATENCAO' && (
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
        {categoriaAtiva === 'CAIXA_ENTRADA' && (
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
        {categoriaAtiva === 'INCONSISTENCIA' && (
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
