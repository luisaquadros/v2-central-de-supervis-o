import React, { useMemo } from 'react';
import { BookOpen, CalendarX, CheckCircle2, ChevronRight, ClipboardList, Play, Sparkles, Users } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import { formatarDataBr, formatarDiaCurto, somarDias } from '../services/supervisaoOperacionalService';
import { PendenciaItem } from '../components/PendenciaItem';
import { TarefasLista } from '../components/TarefasLista';
import { Botao, Cartao, Secao, Selo, Vazio } from '../components/ui';

const quando = (diasAte: number, data: string) =>
  diasAte === 0 ? 'hoje' : diasAte === 1 ? 'amanhã' : formatarDiaCurto(data);

/**
 * Tela inicial em 4 blocos fixos: AGORA (uma ação), FAZER (pendências com botão),
 * LEMBRETES e PRÓXIMOS DIAS. Números que não pedem ação ficam dentro de cada turma.
 */
export const HojeView: React.FC = () => {
  const {
    agora, hojeIso, supervisaoAtual, proximaSupervisao, pendencias, getAulasDoDia, getLeiturasDoEncontro,
    getResponsaveisLeitura, casosDiscussao, marcosAcademicos, getTurmasDoPeriodo, marcarEncontroNaoRealizado,
  } = useSupervisao();
  const { abrirAula, abrirTurma, abrirPreparar, abrirAba } = useNavegacao();

  const dataExtenso = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const titulo = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);
  const saudacao = agora.getHours() < 12 ? 'Bom dia' : agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  const proximosDias = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => somarDias(hojeIso, i)).flatMap(data =>
      getAulasDoDia(data).map(aula => ({ aula, leituras: getLeiturasDoEncontro(aula.turma.turma_id, data) }))),
  [hojeIso, getAulasDoDia, getLeiturasDoEncontro]);

  const turmasIds = new Set(getTurmasDoPeriodo().map(t => t.turma_id));
  const prazos = marcosAcademicos
    .filter(m => m.data_prazo >= hojeIso && m.data_prazo <= somarDias(hojeIso, 14) && (!m.turma_id || turmasIds.has(m.turma_id)))
    .sort((a, b) => a.data_prazo.localeCompare(b.data_prazo))
    .filter((m, i, lista) => lista.findIndex(x => x.nome === m.nome && x.data_prazo === m.data_prazo) === i)
    .slice(0, 4);

  const emAndamento = supervisaoAtual.emAndamento;
  const pendenteHoje = supervisaoAtual.chamadaPendenteHoje;
  const prox = proximaSupervisao;
  const leiturasProx = prox ? getLeiturasDoEncontro(prox.turma.turma_id, prox.dataProxima) : [];
  const casosProx = prox ? casosDiscussao.filter(c => c.turma_id === prox.turma.turma_id && c.status !== 'DISCUTIDO').length : 0;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-slate-500">{titulo}</p>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{saudacao}!</h1>
      </header>

      {/* AGORA */}
      {emAndamento ? (
        <div className="rounded-2xl bg-slate-900 text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-amber-300 font-bold text-sm uppercase tracking-wide">Aula agora</p>
            <p className="text-2xl font-black mt-1">{emAndamento.turma.nome}</p>
            <p className="text-slate-300 mt-0.5">{emAndamento.horaInicio}–{emAndamento.horaFim}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => abrirPreparar(emAndamento.turma.turma_id, hojeIso)} icone={<Sparkles className="w-4 h-4" />}>Resumo</Botao>
            <Botao variante="destaque" tamanho="lg" onClick={() => abrirAula(emAndamento.turma.turma_id, hojeIso)} icone={<Play className="w-5 h-5 fill-current" />}>
              Entrar na aula
            </Botao>
          </div>
        </div>
      ) : pendenteHoje ? (
        <div className="rounded-2xl bg-red-50 border-2 border-red-300 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-red-700 font-bold text-sm uppercase tracking-wide">Falta a chamada de hoje</p>
            <p className="text-xl font-black text-slate-900 mt-1">{pendenteHoje.turma.nome}</p>
            <p className="text-slate-700">A aula terminou às {pendenteHoje.horaFim}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => void marcarEncontroNaoRealizado(pendenteHoje.turma.turma_id, hojeIso, 'Aula não realizada')} icone={<CalendarX className="w-4 h-4" />}>
              Não houve aula
            </Botao>
            <Botao variante="perigo" tamanho="lg" onClick={() => abrirAula(pendenteHoje.turma.turma_id, hojeIso)}>Fazer chamada</Botao>
          </div>
        </div>
      ) : prox ? (
        <Cartao className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-slate-500 font-bold text-sm uppercase tracking-wide">Próxima aula · {quando(prox.diasAte, prox.dataProxima)}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{prox.turma.nome}</p>
              <p className="text-slate-600">{prox.horaInicio}–{prox.horaFim}</p>
              {leiturasProx.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {leiturasProx.map(l => (
                    <li key={l.leitura_id} className="text-sm text-slate-700 flex gap-2">
                      <BookOpen className="w-4 h-4 mt-0.5 text-violet-600 shrink-0" />
                      <span><strong>{l.tema}</strong>{getResponsaveisLeitura(l).length > 0 && <> — {getResponsaveisLeitura(l).map(r => r.nome).join(', ')}</>}</span>
                    </li>
                  ))}
                </ul>
              )}
              {casosProx > 0 && <p className="mt-2 text-sm text-slate-700"><ClipboardList className="inline w-4 h-4 mr-1" />{casosProx} caso(s) na fila para discutir</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Botao variante="primario" onClick={() => abrirPreparar(prox.turma.turma_id, prox.dataProxima)} icone={<Sparkles className="w-4 h-4" />}>Preparar aula</Botao>
              {prox.diasAte === 0 && <Botao onClick={() => abrirAula(prox.turma.turma_id, prox.dataProxima)} icone={<Play className="w-4 h-4" />}>Entrar</Botao>}
            </div>
          </div>
        </Cartao>
      ) : (
        <Cartao className="p-5"><Vazio titulo="Nenhuma aula prevista nos próximos dias" texto="Confira os horários das turmas em Turmas → Editar." /></Cartao>
      )}

      {supervisaoAtual.naoRealizadasHoje.map(a => (
        <p key={a.turma.turma_id} className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          Hoje não há aula de <strong>{a.turma.nome}</strong>: {a.situacao === 'REAGENDADA' ? `reagendada para ${formatarDataBr(a.dataReagendada)}` : a.motivo}.
        </p>
      ))}

      {/* FAZER */}
      <Secao titulo={<>Fazer {pendencias.length > 0 && <Selo cor="ambar">{pendencias.length}</Selo>}</>}
        acao={pendencias.length > 5 && <Botao variante="fantasma" tamanho="sm" onClick={() => abrirAba('pendencias')}>Ver todas <ChevronRight className="w-4 h-4" /></Botao>}>
        {pendencias.length === 0 ? (
          <Vazio icone={<CheckCircle2 className="w-8 h-8 text-emerald-500" />} titulo="Tudo em dia" texto="Nenhuma chamada, justificativa ou documento esperando por você." />
        ) : (
          <ul className="space-y-2">{pendencias.slice(0, 5).map(p => <PendenciaItem key={p.id} item={p} />)}</ul>
        )}
      </Secao>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* LEMBRETES */}
        <Secao titulo="Meus lembretes">
          <TarefasLista limite={5} />
        </Secao>

        {/* PRÓXIMOS DIAS */}
        <Secao titulo="Próximos 7 dias" acao={<Botao variante="fantasma" tamanho="sm" onClick={() => abrirAba('calendario')}>Calendário</Botao>}>
          {proximosDias.length === 0 ? <Vazio titulo="Sem aulas nos próximos 7 dias" /> : (
            <ul className="divide-y divide-slate-100">
              {proximosDias.map(({ aula, leituras }) => (
                <li key={`${aula.turma.turma_id}-${aula.data}`}>
                  <button onClick={() => abrirTurma(aula.turma.turma_id, 'aulas')} className="w-full text-left py-2.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 rounded-lg px-1">
                    <span className="w-24 shrink-0 text-sm font-semibold text-slate-700 capitalize">{formatarDiaCurto(aula.data)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" />{aula.turma.nome}</span>
                      {aula.situacao !== 'PREVISTA'
                        ? <span className="text-sm text-amber-800">{aula.situacao === 'REAGENDADA' ? `Reagendada para ${formatarDataBr(aula.dataReagendada)}` : aula.motivo}</span>
                        : leituras.length > 0 && <span className="text-sm text-slate-600 block truncate">📖 {leituras.map(l => l.tema).join(' · ')}</span>}
                    </span>
                    <span className="text-sm text-slate-500">{aula.horaInicio}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {prazos.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-700 mb-1">Prazos</p>
              <ul className="space-y-1">
                {prazos.map(m => (
                  <li key={m.marco_id} className="text-sm text-slate-700"><strong>{formatarDataBr(m.data_prazo)}</strong> — {m.nome}</li>
                ))}
              </ul>
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
};
