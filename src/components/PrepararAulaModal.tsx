import React from 'react';
import { X, Play, BookOpen, AlertTriangle, Clock, Users, CheckCircle, FileText, Calendar } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { Turma } from '../types';
import { AulaPreparacaoPainel } from './AulaPreparacaoPainel';
import { obterLeiturasAgendadas, getHojeDataIso } from '../services/supervisaoOperacionalService';
import { gerarSugestoesRss } from '../services/sugestoesAulaService';

interface PrepararAulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  turma: Turma;
  onIniciarModoAula: (turmaId: string) => void;
}

export const PrepararAulaModal: React.FC<PrepararAulaModalProps> = ({
  isOpen,
  onClose,
  turma,
  onIniciarModoAula,
}) => {
  const {
    getAlunosDaTurma,
    getResumoAlunoSupervisao,
    leiturasResponsaveis,
    orientacoes,
    marcosAcademicos,
    documentos,
    pontosAcompanhamento,
    gruposPratica,
    encontrosTurma,
    registrosSemanais,
  } = useSupervisao();

  if (!isOpen) return null;

  const alunosDaTurma = getAlunosDaTurma(turma.turma_id);

  // Alunos com atenção
  const alunosComAtencao = alunosDaTurma
    .map(a => getResumoAlunoSupervisao(a.matricula.matricula_id))
    .filter((res): res is NonNullable<typeof res> => res !== null && res.temAtencao);

  // Orientações abertas
  const matriculaIdsTurma = new Set(alunosDaTurma.map(a => a.matricula.matricula_id));
  const orientacoesAbertas = orientacoes.filter(
    o => matriculaIdsTurma.has(o.matricula_id) && o.status === 'ABERTA'
  );

  // Próxima leitura
  const hojeStr = getHojeDataIso();
  const proximasLeituras = obterLeiturasAgendadas(
    leiturasResponsaveis.filter(l => l.turma_id === turma.turma_id),
    encontrosTurma
  );
  const leitura = proximasLeituras.find(l => l.data_apresentacao >= hojeStr) || proximasLeituras.at(-1);

  // RSS dos últimos 14 dias: grupo (Clínica Ampliada) ou estudante é a unidade.
  const gruposDaTurma = gruposPratica.filter(g => g.turma_id === turma.turma_id);
  const unidadesRss = gruposDaTurma.length
    ? gruposDaTurma.map(g => ({ unidadeId: g.grupo_id, tipo: 'GRUPO' as const, nome: g.nome_grupo || 'Grupo' }))
    : alunosDaTurma.map(a => ({ unidadeId: a.matricula.matricula_id, tipo: 'INDIVIDUAL' as const, nome: a.aluno.nome }));
  const nomeDaUnidade = (r: any) => unidadesRss.find(u => u.unidadeId === (r.grupo_id || r.matricula_id))?.nome || String(r.responsavel_nome || 'Estudante');
  const sugestoesRss = gerarSugestoesRss({
    turmaId: turma.turma_id, registros: registrosSemanais, unidades: unidadesRss, nomeDe: nomeDaUnidade,
    hojeIso: hojeStr, temaLeitura: leitura?.titulo || leitura?.tema,
  });
  const fmtData = (iso: string) => iso.split('-').reverse().join('/');

  // Documentos pendentes
  const docsPendentes = documentos.filter(
    d => matriculaIdsTurma.has(d.matricula_id) && d.status === 'PENDENTE'
  );

  // Próximos prazos
  const proximosMarcos = marcosAcademicos.filter(
    m => m.turma_id === turma.turma_id || !m.turma_id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                Briefing Estruturado
              </span>
              <span className="text-xs text-slate-500 font-medium">Preparação de Supervisão</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">{turma.nome}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto min-h-0 space-y-4 flex-1 text-xs mobile-scroll">
          <AulaPreparacaoPainel turmaId={turma.turma_id} />
          {/* 1. Leitura do Encontro */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold">
              <BookOpen className="w-4 h-4" />
              <span>Leitura & Discussão Teórica</span>
            </div>
            {leitura ? (
              <div className="pl-6 space-y-1">
                <div className="font-bold text-slate-900 text-xs">{leitura.tema || leitura.titulo || 'Sem título'}</div>
                <div className="text-slate-500">
                  Responsáveis: <strong className="text-slate-800">{leitura.tipo === 'LEITURA_RECOMENDADA' ? 'Leitura coletiva (sem responsável)' : (leitura.responsavel_nome || leitura.responsavel_id || 'A confirmar')}</strong>
                </div>
                {leitura.data && <div className="text-[11px] text-slate-400">Próxima apresentação: {leitura.data_apresentacao}{leitura.reprogramada && ` (transferida de ${leitura.data_original})`}</div>}
              </div>
            ) : (
              <div className="pl-6 text-slate-400">Nenhuma leitura programada especificamente.</div>
            )}
          </div>

          {/* 1b. O que os estudantes relataram nos últimos 14 dias */}
          <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2" data-testid="sugestoes-rss">
            <div className="flex items-center gap-2 text-indigo-900 font-bold">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Sugestões do RSS (últimos 14 dias)</span>
            </div>
            <p className="pl-6 text-[11px] text-slate-500">
              {sugestoesRss.totalRelatos} relato(s) de {fmtData(sugestoesRss.de)} a {fmtData(sugestoesRss.ate)}. Os temas são palavras que se repetem nos relatos; confira o texto antes de usar.
            </p>
            {sugestoesRss.sugestoes.length === 0 ? (
              <div className="pl-6 text-slate-500">Sem relatos nesse período para sugerir temas.</div>
            ) : (
              <ul className="pl-6 list-disc ml-3 space-y-1 text-slate-800">
                {sugestoesRss.sugestoes.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
            {(sugestoesRss.prioritarios.length > 0 || sugestoesRss.duvidas.length > 0) && (
              <details className="pl-6">
                <summary className="cursor-pointer text-indigo-800 font-semibold text-xs min-h-[32px]">
                  Ler o que foi relatado ({sugestoesRss.prioritarios.length} prioridade, {sugestoesRss.duvidas.length} dúvida)
                </summary>
                <div className="space-y-2 mt-1">
                  {[...sugestoesRss.prioritarios.map(x => ({ ...x, rotulo: 'Prioridade' })), ...sugestoesRss.duvidas.map(x => ({ ...x, rotulo: 'Dúvida' }))].map(x => (
                    <div key={x.rotulo + x.registroId} className="text-xs">
                      <span className="font-semibold text-slate-700">{x.rotulo} · {x.unidade} · {fmtData(x.data)}{x.emRevisao ? ' · em revisão' : ''}</span>
                      <p className="text-slate-800 whitespace-pre-wrap break-words">{x.texto}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {sugestoesRss.unidadesSemRelato.length > 0 && (
              <p className="pl-6 text-[11px] text-amber-800">Sem RSS no período: {sugestoesRss.unidadesSemRelato.join(', ')}.</p>
            )}
          </div>

          {/* 2. Pessoas que precisam de atenção imediata */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
            <div className="flex items-center justify-between text-amber-900 font-bold">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Casos para Atenção Nesta Aula ({alunosComAtencao.length})</span>
              </div>
            </div>
            {alunosComAtencao.length === 0 ? (
              <div className="pl-6 text-slate-500">Nenhum estudante em situação de prioridade.</div>
            ) : (
              <div className="pl-6 space-y-1.5">
                {alunosComAtencao.slice(0, 5).map(res => (
                  <div key={res.aluno.aluno_id} className="flex items-start justify-between">
                    <div>
                      <strong className="text-slate-900">{res.aluno.nome}</strong>
                      <span className="text-slate-500 block text-[11px]">
                        {res.motivosAtencao.join(' • ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Orientações em Aberto para Retomar */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Orientações da Supervisão Anterior para Retomar ({orientacoesAbertas.length})</span>
            </div>
            {orientacoesAbertas.length === 0 ? (
              <div className="pl-6 text-slate-400">Nenhuma orientação pendente de acompanhamento.</div>
            ) : (
              <div className="pl-6 space-y-2">
                {orientacoesAbertas.slice(0, 4).map(o => {
                  const mat = alunosDaTurma.find(a => a.matricula.matricula_id === o.matricula_id);
                  return (
                    <div key={o.orientacao_id} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="font-bold text-slate-800">{mat?.aluno.nome} ({o.categoria})</div>
                      <div className="text-slate-600 mt-0.5">"{o.texto}"</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detalhes secundários recolhidos para reduzir ruído visual. */}
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="font-semibold text-xs text-slate-700 cursor-pointer">Documentos e prazos · detalhes</summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Documentação Pendente</span>
              <span className="text-sm font-bold text-slate-900">{docsPendentes.length} pendência(s)</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Próximo Marco Acadêmico</span>
              <span className="text-sm font-bold text-slate-900">
                {proximosMarcos[0] ? proximosMarcos[0].nome : 'Em dia'}
              </span>
            </div>
          </div>
          </details>
        </div>

        {/* Footer with action */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Fechar Briefing
          </button>
          <button
            onClick={() => {
              onClose();
              onIniciarModoAula(turma.turma_id);
            }}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Iniciar Supervisão / Modo Aula</span>
          </button>
        </div>
      </div>
    </div>
  );
};
