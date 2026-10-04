import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, BookOpen, Layers, Award, AlertCircle, Users } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

export const CalendarioView: React.FC = () => {
  const {
    horariosTurma,
    turmas,
    calendarioRss,
    leiturasResponsaveis,
    marcosAcademicos,
    selectedPeriodoId,
  } = useSupervisao();

  const [relogioAtivo, setRelogioAtivo] = useState<'AULAS' | 'PRATICA_RSS' | 'LEITURAS' | 'MARCOS'>('PRATICA_RSS');

  const diasSemanaNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Calendário Integrado da Supervisão
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Três Relógios Acadêmicos Independentes
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Separação rigorosa entre horários de supervisão, cronograma de prática/RSS e leituras teóricas
        </p>
      </div>

      {/* Relógios Switch Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setRelogioAtivo('PRATICA_RSS')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            relogioAtivo === 'PRATICA_RSS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase">1. Prática + RSS</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-sm font-black">Cronograma Semanal</span>
          <span className={`text-[11px] mt-1 ${relogioAtivo === 'PRATICA_RSS' ? 'text-slate-300' : 'text-slate-400'}`}>
            calendario_rss ({calendarioRss.length > 0 ? `${calendarioRss.length} semanas` : 'Conforme a base'})
          </span>
        </button>

        <button
          onClick={() => setRelogioAtivo('AULAS')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            relogioAtivo === 'AULAS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase">2. Supervisão / Aulas</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-sm font-black">Dias & Horários</span>
          <span className={`text-[11px] mt-1 ${relogioAtivo === 'AULAS' ? 'text-slate-300' : 'text-slate-400'}`}>
            horarios_turma (encontros presenciais)
          </span>
        </button>

        <button
          onClick={() => setRelogioAtivo('LEITURAS')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            relogioAtivo === 'LEITURAS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase">3. Leituras & Textos</span>
            <BookOpen className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-sm font-black">Seminários & Temas</span>
          <span className={`text-[11px] mt-1 ${relogioAtivo === 'LEITURAS' ? 'text-slate-300' : 'text-slate-400'}`}>
            leituras_responsaveis
          </span>
        </button>

        <button
          onClick={() => setRelogioAtivo('MARCOS')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            relogioAtivo === 'MARCOS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase">4. Marcos Acadêmicos</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-sm font-black">Prazos & Provas</span>
          <span className={`text-[11px] mt-1 ${relogioAtivo === 'MARCOS' ? 'text-slate-300' : 'text-slate-400'}`}>
            marcos_academicos
          </span>
        </button>
      </div>

      {/* Relógio 1: Prática + RSS */}
      {relogioAtivo === 'PRATICA_RSS' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Calendário de Prática & Semanas de RSS</h2>
              <p className="text-xs text-slate-500">
                Cronograma semanal da prática: semana aberta não gera atraso e feriados não eliminam a obrigação
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">Tabela calendario_rss</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {calendarioRss.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                Aguardando carregamento do cronograma da tabela calendario_rss.
              </div>
            ) : (
              calendarioRss
                .slice()
                .sort((a, b) => (Number(a.semana) || 0) - (Number(b.semana) || 0))
                .map(itemCal => {
                  const sem = Number(itemCal.semana) || 0;
                  const hojeStr = new Date().toISOString().split('T')[0];
                  const isEncerrada = itemCal.data_limite ? itemCal.data_limite < hojeStr : false;
                  const isAtual = itemCal.data_prevista && itemCal.data_limite
                    ? hojeStr >= itemCal.data_prevista && hojeStr <= itemCal.data_limite
                    : false;

                  return (
                    <div
                      key={itemCal.calendario_id || sem}
                      className={`p-4 rounded-xl border space-y-2 ${
                        isAtual
                          ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                          : isEncerrada
                          ? 'border-slate-200 bg-slate-50/50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Semana {sem}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isAtual
                              ? 'bg-indigo-600 text-white'
                              : isEncerrada
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isAtual ? 'Semana Atual' : isEncerrada ? 'Encerrada' : 'Futura'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-0.5 font-medium">
                        <div>Data Prevista: <strong className="text-slate-800">{itemCal.data_prevista || 'A definir'}</strong></div>
                        <div>Data Limite: <strong className="text-slate-800">{itemCal.data_limite || 'A definir'}</strong></div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Relógio 2: Supervisão / Aulas */}
      {relogioAtivo === 'AULAS' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Encontros Semanais de Supervisão Presencial</h2>
            <p className="text-xs text-slate-500">Dias da semana e horários fixados na tabela horarios_turma</p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {turmas.map(t => {
              const horario = horariosTurma.find(h => h.turma_id === t.turma_id);

              return (
                <div key={t.turma_id} className="p-4 flex items-center justify-between gap-3 bg-white">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{t.nome}</span>
                    <span className="text-[11px] text-slate-500">Turno: {t.turno}</span>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-xs text-slate-900 block font-mono">
                      {horario ? `${horario.hora_inicio} às ${horario.hora_fim}` : 'Horário da grade'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {horario ? diasSemanaNomes[horario.dia_semana] || 'Semanal' : 'Dia letivo'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Relógio 3: Leituras */}
      {relogioAtivo === 'LEITURAS' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Cronograma de Leituras & Seminários</h2>
            <p className="text-xs text-slate-500">Temas e responsáveis atribuídos na tabela leituras_responsaveis</p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {leiturasResponsaveis.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhuma leitura registrada na tabela oficial leituras_responsaveis.
              </div>
            ) : (
              leiturasResponsaveis.map((l, idx) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{l.tema || l.titulo || 'Texto de Supervisão'}</span>
                    <span className="text-[11px] text-slate-500">
                      Responsável: <strong className="text-slate-800">{l.responsavel_nome || l.responsavel_id || 'Turma em geral'}</strong>
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 self-start sm:self-auto">
                    {l.data || 'Data a definir'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Relógio 4: Marcos Acadêmicos */}
      {relogioAtivo === 'MARCOS' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Marcos Acadêmicos e Entregas Formais</h2>
            <p className="text-xs text-slate-500">Datas limites oficiais de provas, relatórios e encerramento</p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {marcosAcademicos.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum marco acadêmico registrado no período atual.
              </div>
            ) : (
              marcosAcademicos.map(m => (
                <div key={m.marco_id} className="p-4 flex items-center justify-between gap-3 bg-white">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{m.nome}</span>
                    <span className="text-[11px] text-slate-400">Tipo: {m.tipo}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100">
                    Prazo: {m.data_prazo}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
