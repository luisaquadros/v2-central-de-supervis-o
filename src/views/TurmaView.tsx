import React, { useMemo, useState } from 'react';
import { BookOpen, CalendarClock, CalendarX, Pencil, Play, RotateCcw, Sparkles, UserPlus, Users } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { AbaTurma, useNavegacao } from '../context/NavegacaoContext';
import {
  aulasDoDia, AulaDoDia, DIAS_SEMANA_NOMES, formatarDataBr, formatarDiaCurto, leituraPrecisaConfirmacao, somarDias,
} from '../services/supervisaoOperacionalService';
import type { Frequencia, Turma } from '../types';
import { TurmaFormModal } from '../components/TurmaFormModal';
import { ImportarAlunosModal } from '../components/ImportarAlunosModal';
import { EstudoDirigidoModal } from '../components/EstudoDirigidoModal';
import { Abas, Botao, Cartao, CLASSE_INPUT, Campo, Janela, Secao, Selo, Vazio } from '../components/ui';

/** Página da turma: tudo da turma num só lugar (estudantes, aulas e frequência, RSS e leituras). */
export const TurmaView: React.FC<{ turmaId: string; abaInicial?: AbaTurma }> = ({ turmaId, abaInicial }) => {
  const { turmas, disciplinas, horariosTurma, getAlunosDaTurma, getRssDaTurma, pendencias, hojeIso, getAulasDoDia, proximaSupervisao } = useSupervisao();
  const { abrirAula, abrirPreparar } = useNavegacao();
  const [aba, setAba] = useState<AbaTurma>(abaInicial || 'alunos');
  const [editando, setEditando] = useState(false);
  const turma = turmas.find(t => t.turma_id === turmaId);
  if (!turma) return <Vazio titulo="Turma não encontrada" />;

  const horario = horariosTurma.find(h => h.turma_id === turmaId && h.ativo);
  const rss = getRssDaTurma(turmaId);
  const nAlunos = getAlunosDaTurma(turmaId).length;
  const aulaHoje = getAulasDoDia(hojeIso).find(a => a.turma.turma_id === turmaId && a.situacao === 'PREVISTA');
  const proxima = proximaSupervisao?.turma.turma_id === turmaId ? proximaSupervisao.dataProxima : aulaHoje?.data;

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{turma.nome}</h1>
          <p className="text-slate-600">
            {(() => { const d = disciplinas.find(x => x.disciplina_id === turma.disciplina_id); return d && d.nome !== turma.nome ? `${d.nome} · ` : d ? `${d.codigo} · ` : ''; })()}
            {horario && horario.dia_semana !== null ? `${DIAS_SEMANA_NOMES[Number(horario.dia_semana)]}, ${horario.hora_inicio}–${horario.hora_fim}` : 'sem horário'} · {nAlunos} estudantes
            {rss.metricas.semanaAtual && <> · semana de prática {rss.metricas.semanaTexto}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="fantasma" icone={<Pencil className="w-4 h-4" />} onClick={() => setEditando(true)}>Editar</Botao>
          {proxima && <Botao icone={<Sparkles className="w-4 h-4" />} onClick={() => abrirPreparar(turmaId, proxima)}>Preparar aula</Botao>}
          {aulaHoje && <Botao variante="primario" icone={<Play className="w-4 h-4" />} onClick={() => abrirAula(turmaId, hojeIso)}>Aula de hoje</Botao>}
        </div>
      </header>

      <Abas<AbaTurma>
        abas={[
          { id: 'alunos', rotulo: 'Estudantes' },
          { id: 'aulas', rotulo: 'Aulas e frequência', contador: pendencias.filter(p => p.turma_id === turmaId && p.tipo === 'CHAMADA').length },
          { id: 'rss', rotulo: 'RSS', contador: rss.atrasadas.length },
          { id: 'leituras', rotulo: 'Leituras' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      {aba === 'alunos' && <AbaEstudantes turma={turma} />}
      {aba === 'aulas' && <AbaAulas turma={turma} />}
      {aba === 'rss' && <AbaRss turmaId={turmaId} />}
      {aba === 'leituras' && <AbaLeituras turmaId={turmaId} />}
      {editando && <TurmaFormModal turma={turma} aoFechar={() => setEditando(false)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------

const AbaEstudantes: React.FC<{ turma: Turma }> = ({ turma }) => {
  const { getAlunosDaTurma, getResumoAlunoSupervisao, getGrupoDoAluno, isTurmaClinicaAmpliada } = useSupervisao();
  const { abrirAluno } = useNavegacao();
  const [importar, setImportar] = useState(false);
  const [filtro, setFiltro] = useState('');
  const alunos = getAlunosDaTurma(turma.turma_id).filter(a => a.aluno.nome.toLowerCase().includes(filtro.toLowerCase()));
  const porGrupo = isTurmaClinicaAmpliada(turma.turma_id);

  return (
    <Cartao className="p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className={`${CLASSE_INPUT} flex-1 min-w-48`} value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar por nome…" />
        <Botao icone={<UserPlus className="w-4 h-4" />} onClick={() => setImportar(true)}>Adicionar estudantes</Botao>
      </div>
      {alunos.length === 0 ? <Vazio icone={<Users className="w-8 h-8" />} titulo="Nenhum estudante" /> : (
        <ul className="divide-y divide-slate-100">
          {alunos.map(({ matricula, aluno }) => {
            const r = getResumoAlunoSupervisao(matricula.matricula_id);
            const grupo = porGrupo ? getGrupoDoAluno(matricula.matricula_id) : undefined;
            return (
              <li key={matricula.matricula_id}>
                <button onClick={() => abrirAluno(matricula.matricula_id)} className="w-full text-left py-2.5 px-1 flex flex-wrap items-center gap-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <span className="flex-1 min-w-48">
                    <span className="font-semibold text-slate-900">{aluno.nome}</span>
                    {(matricula as any).papel_na_turma === 'REPRESENTANTE' && <Selo cor="roxo" className="ml-2">representante</Selo>}
                    {grupo && <span className="block text-sm text-slate-500">{grupo.nome_grupo}</span>}
                  </span>
                  {r && r.faltasInjustificadasCount > 0 && <Selo cor="vermelho">{r.faltasInjustificadasCount} falta(s)</Selo>}
                  {r?.situacaoRss?.estaAtrasado && <Selo cor="ambar">RSS −{Math.abs(r.situacaoRss.saldoRss)}</Selo>}
                  {r && r.docsPendentesCount > 0 && <Selo cor="ambar">{r.docsPendentesCount} doc.</Selo>}
                  {r && r.pontosAtivos.length > 0 && <Selo cor="azul">{r.pontosAtivos.length} ponto(s)</Selo>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {importar && <ImportarAlunosModal turmaId={turma.turma_id} aoFechar={() => setImportar(false)} />}
    </Cartao>
  );
};

// ---------------------------------------------------------------------------

const SIGLA: Record<Frequencia['status'], { t: string; c: string }> = {
  PRESENTE: { t: 'P', c: 'bg-emerald-100 text-emerald-800' },
  FALTA_SEM_JUSTIFICATIVA: { t: 'F', c: 'bg-red-100 text-red-800' },
  FALTA_JUSTIFICADA: { t: 'FJ', c: 'bg-blue-100 text-blue-800' },
  JUSTIFICATIVA_PENDENTE: { t: 'J?', c: 'bg-amber-100 text-amber-900' },
};

const AbaAulas: React.FC<{ turma: Turma }> = ({ turma }) => {
  const {
    periodoAtual, horariosTurma, encontrosTurma, frequencias, matriculas, hojeIso, agora, getAlunosDaTurma,
    marcarEncontroNaoRealizado, reverterEncontro, getLeiturasDoEncontro, dispensarChamada,
  } = useSupervisao();
  const { abrirAula, abrirAluno } = useNavegacao();
  const [reagendar, setReagendar] = useState<string | null>(null);
  const [verGrade, setVerGrade] = useState(false);

  const aulas = useMemo(() => {
    const inicio = periodoAtual?.data_inicio || somarDias(hojeIso, -120);
    const fim = periodoAtual?.data_fim || somarDias(hojeIso, 60);
    const lista: AulaDoDia[] = [];
    for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
      lista.push(...aulasDoDia(d, [turma], horariosTurma, encontrosTurma, frequencias, matriculas));
    }
    return lista;
  }, [turma, periodoAtual, horariosTurma, encontrosTurma, frequencias, matriculas, hojeIso]);

  const passadas = aulas.filter(a => a.data <= hojeIso).reverse();
  const futuras = aulas.filter(a => a.data > hojeIso);
  const alunos = getAlunosDaTurma(turma.turma_id);
  const datasComChamada = passadas.filter(a => a.chamadaSalva).map(a => a.data).reverse();

  const Linha: React.FC<{ a: AulaDoDia }> = ({ a }) => {
    const leituras = getLeiturasDoEncontro(turma.turma_id, a.data);
    const freqs = frequencias.filter(f => f.data_aula === a.data && alunos.some(x => x.matricula.matricula_id === f.matricula_id));
    const faltas = freqs.filter(f => f.status !== 'PRESENTE').length;
    const horaAgora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    // A aula de hoje só vira pendência depois que termina.
    const emCurso = a.data === hojeIso && !a.chamadaSalva && horaAgora < a.horaFim;
    const passada = a.data <= hojeIso;
    // Aulas antigas sem chamada no app (antes de começar a usá-lo) não são alarme.
    const recente = a.data >= somarDias(hojeIso, -14);
    return (
      <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 capitalize">{formatarDiaCurto(a.data)} {a.extra && <Selo cor="roxo">reposição</Selo>}</p>
          <p className="text-sm text-slate-600">
            {a.situacao === 'NAO_REALIZADA' ? <span className="text-amber-800">{a.motivo}</span>
              : a.situacao === 'REAGENDADA' ? <span className="text-amber-800">Reagendada para {formatarDataBr(a.dataReagendada)}</span>
              : a.chamadaSalva && freqs.length === 0 ? <span className="text-emerald-700">Chamada feita no Docente Online</span>
              : a.chamadaSalva ? <span className="text-emerald-700">Chamada feita · {freqs.length - faltas} presentes, {faltas} falta(s)</span>
              : emCurso ? <span className="text-slate-700 font-semibold">Hoje, {a.horaInicio}–{a.horaFim}</span>
              : passada && recente ? <span className="text-red-700 font-semibold">Chamada pendente</span>
              : passada ? <span className="text-slate-500">Sem chamada no app</span>
              : 'Prevista'}
            {leituras.length > 0 && <span className="block truncate">📖 {leituras.map(l => l.tema).join(' · ')}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {a.situacao === 'PREVISTA' && passada && (
            <Botao variante={a.chamadaSalva || !recente ? 'secundario' : 'primario'} tamanho="sm" icone={<Play className="w-4 h-4" />} onClick={() => abrirAula(turma.turma_id, a.data)}>
              {a.chamadaSalva ? 'Ver chamada' : emCurso ? 'Entrar na aula' : 'Fazer chamada'}
            </Botao>
          )}
          {a.situacao === 'PREVISTA' && !a.chamadaSalva && passada && recente && !emCurso && (
            <Botao variante="fantasma" tamanho="sm" onClick={() => void dispensarChamada(turma.turma_id, a.data)}>Já fiz no Docente</Botao>
          )}
          {a.situacao === 'PREVISTA' && !a.chamadaSalva && (!passada || recente) && (
            <>
              <Botao variante="fantasma" tamanho="sm" icone={<CalendarX className="w-4 h-4" />} onClick={() => void marcarEncontroNaoRealizado(turma.turma_id, a.data, 'Aula não realizada')}>Não houve</Botao>
              <Botao variante="fantasma" tamanho="sm" icone={<CalendarClock className="w-4 h-4" />} onClick={() => setReagendar(a.data)}>Reagendar</Botao>
            </>
          )}
          {a.encontro && a.situacao !== 'PREVISTA' && (
            <Botao variante="fantasma" tamanho="sm" icone={<RotateCcw className="w-4 h-4" />} onClick={() => void reverterEncontro(turma.turma_id, a.data)}>Desfazer</Botao>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <Secao titulo="Aulas já realizadas" acao={datasComChamada.length > 0 && (
        <Botao variante="fantasma" tamanho="sm" onClick={() => setVerGrade(v => !v)}>{verGrade ? 'Ocultar grade' : 'Grade de presença'}</Botao>
      )}>
        {verGrade && (
          <div className="overflow-x-auto mb-4 -mx-1">
            <table className="text-sm border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left font-semibold text-slate-600 pr-2 sticky left-0 bg-white">Estudante</th>
                  {datasComChamada.map(d => <th key={d} className="font-semibold text-slate-600 px-1">{formatarDataBr(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {alunos.map(({ matricula, aluno }) => (
                  <tr key={matricula.matricula_id}>
                    <td className="pr-2 sticky left-0 bg-white">
                      <button onClick={() => abrirAluno(matricula.matricula_id, 'frequencia')} className="text-left text-slate-800 hover:underline cursor-pointer whitespace-nowrap">{aluno.nome}</button>
                    </td>
                    {datasComChamada.map(d => {
                      const f = frequencias.find(x => x.matricula_id === matricula.matricula_id && x.data_aula === d);
                      const s = f ? SIGLA[f.status] : null;
                      return <td key={d} className={`text-center rounded-md px-1.5 py-1 font-semibold ${s?.c || 'text-slate-300'}`}>{s?.t || '·'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-1">P presente · F falta · FJ falta justificada · J? justificativa para avaliar</p>
          </div>
        )}
        {passadas.length === 0 ? <Vazio titulo="Nenhuma aula realizada ainda" /> : <ul className="divide-y divide-slate-100">{passadas.map(a => <Linha key={a.data} a={a} />)}</ul>}
      </Secao>
      <Secao titulo="Próximas aulas">
        {futuras.length === 0 ? <Vazio titulo="Nenhuma aula futura no semestre" /> : <ul className="divide-y divide-slate-100">{futuras.map(a => <Linha key={a.data} a={a} />)}</ul>}
      </Secao>
      {reagendar && <ReagendarModal turmaId={turma.turma_id} data={reagendar} aoFechar={() => setReagendar(null)} />}
    </div>
  );
};

export const ReagendarModal: React.FC<{ turmaId: string; data: string; aoFechar: () => void }> = ({ turmaId, data, aoFechar }) => {
  const { reagendarEncontro, horariosTurma } = useSupervisao();
  const horario = horariosTurma.find(h => h.turma_id === turmaId && h.ativo);
  const [novaData, setNovaData] = useState('');
  const [hora, setHora] = useState(horario?.hora_inicio || '');
  const [motivo, setMotivo] = useState('');
  return (
    <Janela titulo="Reagendar aula" subtitulo={`Aula de ${formatarDiaCurto(data)}`} aoFechar={aoFechar} largura="sm"
      rodape={<>
        <Botao onClick={aoFechar}>Cancelar</Botao>
        <Botao variante="primario" disabled={!novaData} onClick={async () => { await reagendarEncontro(turmaId, data, novaData, hora, motivo || 'Reagendamento'); aoFechar(); }}>Reagendar</Botao>
      </>}>
      <div className="space-y-3">
        <Campo rotulo="Nova data"><input type="date" className={CLASSE_INPUT} value={novaData} onChange={e => setNovaData(e.target.value)} /></Campo>
        <Campo rotulo="Horário"><input type="time" className={CLASSE_INPUT} value={hora} onChange={e => setHora(e.target.value)} /></Campo>
        <Campo rotulo="Motivo (opcional)"><input className={CLASSE_INPUT} value={motivo} onChange={e => setMotivo(e.target.value)} /></Campo>
        <p className="text-sm text-slate-500">As leituras e o estudo dirigido desta aula passam para a nova data. A data original não gera chamada pendente.</p>
      </div>
    </Janela>
  );
};

// ---------------------------------------------------------------------------

type FiltroRss = 'TODOS' | 'ATRASADOS' | 'SEM_ENVIO';

/** Uma lista só: quem precisa de RSS, do que falta mais para o que falta menos. */
const AbaRss: React.FC<{ turmaId: string }> = ({ turmaId }) => {
  const { getRssDaTurma } = useSupervisao();
  const { abrirAluno } = useNavegacao();
  const rss = getRssDaTurma(turmaId);
  const [aberto, setAberto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroRss>('TODOS');
  const semana = rss.metricas.semanaAtual;

  if (!rss.metricas.temDados && rss.unidades.every(u => u.esperados === 0)) {
    return <Cartao><Vazio titulo="Sem cronograma de RSS para esta turma" texto="O RSS vem do formulário e do calendário na planilha (abas calendario_rss e status_rss_unidades)." /></Cartao>;
  }

  const precisam = rss.unidades
    .filter(u => u.faltando > 0 || u.semEnvioNaSemana)
    .filter(u => filtro === 'TODOS' || (filtro === 'ATRASADOS' ? u.faltando > 0 : u.semEnvioNaSemana))
    .sort((a, b) => b.faltando - a.faltando || Number(b.semEnvioNaSemana) - Number(a.semEnvioNaSemana) || a.nome.localeCompare(b.nome));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Cartao className="p-3 text-center"><p className="text-2xl font-black text-slate-900">{rss.metricas.semanaTexto}</p><p className="text-sm text-slate-600">semana de prática</p></Cartao>
        <Cartao className="p-3 text-center"><p className="text-2xl font-black text-amber-700">{rss.atrasadas.length}</p><p className="text-sm text-slate-600">com RSS atrasado</p></Cartao>
        <Cartao className="p-3 text-center"><p className="text-2xl font-black text-emerald-700">{rss.emDia}</p><p className="text-sm text-slate-600">em dia</p></Cartao>
      </div>

      <Secao titulo={`Quem precisa enviar (${precisam.length})`}
        acao={
          <div className="flex flex-wrap gap-1">
            {([['TODOS', 'Todos'], ['ATRASADOS', `Atrasados (${rss.atrasadas.length})`], ...(semana ? [['SEM_ENVIO', `Sem envio na semana ${semana} (${rss.semEnvioNaSemana.length})`]] : [])] as [FiltroRss, string][]).map(([id, rotulo]) => (
              <button key={id} onClick={() => setFiltro(id)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold cursor-pointer ${filtro === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {rotulo}
              </button>
            ))}
          </div>
        }>
        {precisam.length === 0 ? <Vazio titulo="Ninguém nesta lista" texto="Todos em dia com o RSS." /> : (
          <ul className="divide-y divide-slate-100">
            {precisam.map(u => (
              <li key={u.unidadeId} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => (u.tipo === 'GRUPO' ? setAberto(aberto === u.unidadeId ? null : u.unidadeId) : abrirAluno(u.unidadeId, 'rss'))}
                    className="flex-1 min-w-40 text-left font-semibold text-slate-900 hover:underline cursor-pointer">
                    {u.nome}{u.tipo === 'GRUPO' && <span className="font-normal text-slate-500"> · {u.integrantes.length} integrantes</span>}
                  </button>
                  {u.faltando > 0 && <Selo cor="ambar">faltam {u.faltando} ({u.realizados} de {u.esperados})</Selo>}
                  {semana && (u.semEnvioNaSemana ? <Selo cor="vermelho">semana {semana} sem envio</Selo> : <Selo cor="verde">semana {semana} enviada</Selo>)}
                  {u.aguardandoRevisao > 0 && <Selo cor="azul">{u.aguardandoRevisao} em revisão</Selo>}
                </div>
                {aberto === u.unidadeId && (
                  <ul className="mt-1 ml-3 text-sm text-slate-600">
                    {u.integrantes.map(i => (
                      <li key={i.matriculaId}><button onClick={() => abrirAluno(i.matriculaId, 'rss')} className="hover:underline cursor-pointer">{i.nome}</button></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>
      <p className="text-sm text-slate-500">O RSS é preenchido pelos estudantes no formulário e chega à planilha automaticamente. Respostas "em revisão" ainda não contam como entregues.</p>
    </div>
  );
};

// ---------------------------------------------------------------------------

const ROTULO_REALIZACAO: Record<string, { t: string; c: 'verde' | 'ambar' | 'vermelho' | 'roxo' }> = {
  REALIZADO: { t: 'apresentado', c: 'verde' },
  PARCIAL: { t: 'parcial', c: 'ambar' },
  NAO_REALIZADO: { t: 'não apresentado', c: 'vermelho' },
  SUBSTITUICAO: { t: 'substituição', c: 'roxo' },
};

const AbaLeituras: React.FC<{ turmaId: string }> = ({ turmaId }) => {
  const { leiturasResponsaveis, getResponsaveisLeitura, hojeIso } = useSupervisao();
  const [registrar, setRegistrar] = useState<string | null>(null);
  const leituras = leiturasResponsaveis.filter(l => l.turma_id === turmaId).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const leituraAtual = leituras.find(l => l.leitura_id === registrar);

  return (
    <Cartao className="p-4">
      {leituras.length === 0 ? <Vazio icone={<BookOpen className="w-8 h-8" />} titulo="Nenhuma leitura cadastrada" texto="As leituras vêm da aba leituras_responsaveis." /> : (
        <ul className="divide-y divide-slate-100">
          {leituras.map(l => {
            const r = l.status_realizacao ? ROTULO_REALIZACAO[l.status_realizacao] : null;
            const passou = (l.data || '') < hojeIso;
            return (
              <li key={l.leitura_id} className={`py-3 flex flex-col sm:flex-row sm:items-center gap-2 ${passou && !r ? '' : passou ? 'opacity-70' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-500">{formatarDiaCurto(l.data || '')} · {String(l.tipo).toUpperCase() === 'ESTUDO_DIRIGIDO' ? 'Estudo dirigido' : 'Leitura recomendada'}</p>
                  <p className="font-semibold text-slate-900">{l.tema}</p>
                  {getResponsaveisLeitura(l).length > 0 && <p className="text-sm text-slate-600">{getResponsaveisLeitura(l).map(x => x.nome).join(', ')}</p>}
                  {l.responsaveis_efetivos && l.responsaveis_efetivos.length > 0 && l.status_realizacao === 'SUBSTITUICAO' && (
                    <p className="text-sm text-violet-700">Apresentou: {l.responsaveis_efetivos.join(', ')}</p>
                  )}
                </div>
                {r && <Selo cor={r.c}>{r.t}</Selo>}
                {passou && leituraPrecisaConfirmacao(l) && <Botao tamanho="sm" variante="primario" onClick={() => setRegistrar(String(l.leitura_id))}>Registrar</Botao>}
                {r && <Botao tamanho="sm" variante="fantasma" onClick={() => setRegistrar(String(l.leitura_id))}>Editar</Botao>}
              </li>
            );
          })}
        </ul>
      )}
      {leituraAtual && <EstudoDirigidoModal leitura={leituraAtual} aoFechar={() => setRegistrar(null)} />}
    </Cartao>
  );
};
