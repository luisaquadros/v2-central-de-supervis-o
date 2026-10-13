import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, LogOut, RefreshCw, TriangleAlert } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { formatarDataBr } from '../services/supervisaoOperacionalService';
import { TABELAS_LIDAS } from '../services/tabelas';
import { Botao, CLASSE_INPUT, Campo, Secao, Selo } from '../components/ui';

/** Conta, semestre, conferência dos dados da planilha e cópia de segurança. */
export const AjustesView: React.FC = () => {
  const {
    currentUser, logoutGoogle, sincronizarAgora, spreadsheetName, spreadsheetUrl, syncStatusState, periodos, selectedPeriodoId,
    setSelectedPeriodoId, createNovoPeriodo, exportDatabaseAsJson, turmas, alunos, matriculas, horariosTurma, getTurmasDoPeriodo,
    entregas, leiturasResponsaveis, registrosSemanais, criterios, getResponsaveisLeitura,
  } = useSupervisao();
  const [novo, setNovo] = useState({ nome: '', inicio: '', fim: '', copiarDe: '' });
  const [criando, setCriando] = useState(false);

  const turmasPeriodo = getTurmasDoPeriodo();
  const problemas = useMemo(() => {
    const lista: string[] = [];
    const ids = new Set(turmasPeriodo.map(t => t.turma_id));
    const semDia = horariosTurma.filter(h => ids.has(h.turma_id) && h.dia_semana === null);
    if (semDia.length) lista.push(`${semDia.length} horário(s) com dia da semana não reconhecido (aba horarios_turma).`);
    const semHorario = turmasPeriodo.filter(t => !horariosTurma.some(h => h.turma_id === t.turma_id && h.ativo));
    if (semHorario.length) lista.push(`Turma(s) sem horário ativo: ${semHorario.map(t => t.nome).join(', ')}.`);
    const alunoIds = new Set(alunos.map(a => a.aluno_id));
    const orfas = matriculas.filter(m => ids.has(m.turma_id) && !alunoIds.has(m.aluno_id));
    if (orfas.length) lista.push(`${orfas.length} matrícula(s) sem estudante correspondente na aba alunos.`);
    const matsPeriodo = matriculas.filter(m => ids.has(m.turma_id));
    const semEmail = matsPeriodo.filter(m => !alunos.find(a => a.aluno_id === m.aluno_id)?.email);
    if (semEmail.length) lista.push(`${semEmail.length} estudante(s) sem e-mail (necessário para enviar devolutivas).`);
    const semCriterio = turmasPeriodo.filter(t => !criterios.some(c => c.turma_id === t.turma_id || (!c.turma_id && c.disciplina_id === t.disciplina_id)));
    if (semCriterio.length) lista.push(`Turma(s) sem critérios de avaliação: ${semCriterio.map(t => t.nome).join(', ')}.`);
    const leiturasSemVinculo = leiturasResponsaveis.filter(l => ids.has(l.turma_id || '') && l.responsaveis_texto
      && getResponsaveisLeitura(l).some(r => !r.matriculaId));
    if (leiturasSemVinculo.length) lista.push(`${leiturasSemVinculo.length} leitura(s) com responsável cujo nome não bate com a lista da turma.`);
    return lista;
  }, [turmasPeriodo, horariosTurma, alunos, matriculas, criterios, leiturasResponsaveis, getResponsaveisLeitura]);

  const exportar = () => {
    const blob = new Blob([exportDatabaseAsJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `central-supervisao-copia-${new Date().toLocaleDateString('sv-SE')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const criar = async () => {
    if (!novo.nome || !novo.inicio || !novo.fim) return;
    setCriando(true);
    try {
      const id = await createNovoPeriodo(novo.nome, novo.inicio, novo.fim, novo.copiarDe || undefined);
      setSelectedPeriodoId(id);
      setNovo({ nome: '', inicio: '', fim: '', copiarDe: '' });
    } finally {
      setCriando(false);
    }
  };

  const ultima = syncStatusState.ultimaSincronizacao ? new Date(syncStatusState.ultimaSincronizacao).toLocaleString('pt-BR') : 'ainda não';

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-slate-900">Ajustes</h1>

      <Secao titulo="Conta e planilha">
        <div className="space-y-2 text-slate-700">
          <p>Conta: <strong>{currentUser?.email}</strong></p>
          <p>Planilha: <a href={spreadsheetUrl} target="_blank" rel="noreferrer" className="font-semibold underline inline-flex items-center gap-1">{spreadsheetName}<ExternalLink className="w-3.5 h-3.5" /></a></p>
          <p>Última leitura: <strong>{ultima}</strong> · Aguardando envio: <strong>{syncStatusState.pendentesCount}</strong></p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Botao variante="primario" icone={<RefreshCw className="w-4 h-4" />} onClick={() => void sincronizarAgora()}>Sincronizar agora</Botao>
            <Botao icone={<LogOut className="w-4 h-4" />} onClick={() => void logoutGoogle()}>Sair da conta</Botao>
          </div>
        </div>
      </Secao>

      <Secao titulo="Conferência da planilha" icone={problemas.length ? <TriangleAlert className="w-5 h-5 text-amber-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            ['Turmas', turmasPeriodo.length], ['Estudantes', matriculas.filter(m => turmasPeriodo.some(t => t.turma_id === m.turma_id)).length],
            ['Documentos', entregas.length], ['RSS recebidos', registrosSemanais.length],
          ].map(([rotulo, n]) => (
            <div key={rotulo as string} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-slate-900">{n}</p><p className="text-sm text-slate-600">{rotulo}</p>
            </div>
          ))}
        </div>
        {problemas.length === 0 ? <p className="text-emerald-800">Nenhum problema encontrado nos dados deste semestre.</p> : (
          <ul className="space-y-1.5">{problemas.map(p => <li key={p} className="text-amber-900 bg-amber-50 rounded-lg px-3 py-2">{p}</li>)}</ul>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold text-slate-700">Abas lidas ({TABELAS_LIDAS.length})</summary>
          <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {TABELAS_LIDAS.map(t => {
              const s = syncStatusState.tabelasStatus[t];
              return (
                <li key={t} className="flex items-center justify-between gap-2">
                  <code className="text-slate-700">{t}</code>
                  {s ? (s.ok ? <Selo cor="verde">{s.count} linhas</Selo> : <Selo cor="ambar" title={s.error}>{s.count} · {s.error ? 'atenção' : ''}</Selo>) : <Selo>—</Selo>}
                </li>
              );
            })}
          </ul>
        </details>
      </Secao>

      <Secao titulo="Semestre">
        <div className="space-y-4">
          <Campo rotulo="Semestre em uso">
            <select className={CLASSE_INPUT} value={selectedPeriodoId} onChange={e => setSelectedPeriodoId(e.target.value)}>
              {periodos.map(p => <option key={p.periodo_id} value={p.periodo_id}>{p.nome} ({formatarDataBr(p.data_inicio, true)} a {formatarDataBr(p.data_fim, true)})</option>)}
            </select>
          </Campo>
          <details>
            <summary className="cursor-pointer font-semibold text-slate-700">Criar novo semestre</summary>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <Campo rotulo="Nome"><input className={CLASSE_INPUT} value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} placeholder="2027.1" /></Campo>
              <Campo rotulo="Copiar turmas, horários e critérios de">
                <select className={CLASSE_INPUT} value={novo.copiarDe} onChange={e => setNovo({ ...novo, copiarDe: e.target.value })}>
                  <option value="">Não copiar</option>
                  {periodos.map(p => <option key={p.periodo_id} value={p.periodo_id}>{p.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Início"><input type="date" className={CLASSE_INPUT} value={novo.inicio} onChange={e => setNovo({ ...novo, inicio: e.target.value })} /></Campo>
              <Campo rotulo="Fim"><input type="date" className={CLASSE_INPUT} value={novo.fim} onChange={e => setNovo({ ...novo, fim: e.target.value })} /></Campo>
            </div>
            <Botao variante="primario" className="mt-3" onClick={() => void criar()} disabled={criando || !novo.nome || !novo.inicio || !novo.fim}>
              {criando ? 'Criando…' : 'Criar semestre'}
            </Botao>
          </details>
        </div>
      </Secao>

      <Secao titulo="Cópia de segurança">
        <p className="text-slate-700 mb-3">A planilha é a cópia oficial. Este arquivo é uma fotografia extra dos dados deste aparelho.</p>
        <Botao icone={<Download className="w-4 h-4" />} onClick={exportar}>Baixar cópia (.json)</Botao>
      </Secao>

      <Secao titulo="Atalhos">
        <ul className="text-slate-700 space-y-1">
          <li><kbd className="px-1.5 py-0.5 rounded bg-slate-100 border">N</kbd> anotar rapidamente</li>
          <li><kbd className="px-1.5 py-0.5 rounded bg-slate-100 border">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border">K</kbd> buscar estudante, turma ou leitura</li>
          <li>Na chamada, todos começam presentes: marque só as exceções.</li>
        </ul>
      </Secao>
    </div>
  );
};
