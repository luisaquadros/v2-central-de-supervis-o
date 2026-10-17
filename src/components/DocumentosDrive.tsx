import React, { useEffect, useMemo, useState } from 'react';
import { CloudOff, FileClock, FolderSearch, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { chamarServidor } from '../services/escritaCoordenadaService';
import {
  AVISO_MODIFICACAO, JANELA_DOCUMENTOS_PADRAO_DIAS, ROTULO_SITUACAO, documentosDaTurma, documentosDoEstudante, resumirMonitoramento,
  type DocumentoMonitorado, type SituacaoDrive,
} from '../services/monitoramentoDocumentosService';

const dataCurta = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—';
};
/** Situação sempre com TEXTO (não só cor); "recente" nunca aparece como "entregue". */
const ESTILO: Record<SituacaoDrive, string> = {
  LOCALIZADO_RECENTE: 'bg-sky-50 text-sky-900 border-sky-200',
  LOCALIZADO_ANTIGO: 'bg-slate-50 text-slate-700 border-slate-200',
  NAO_ENCONTRADO_NA_PASTA: 'bg-amber-50 text-amber-900 border-amber-300',
  SEM_PERMISSAO: 'bg-amber-50 text-amber-900 border-amber-300',
  NAO_VERIFICADO: 'bg-slate-50 text-slate-600 border-slate-200',
  A_CONFERIR: 'bg-amber-50 text-amber-900 border-amber-300',
};
const PRECISA_CONFERIR = new Set<SituacaoDrive>(['NAO_ENCONTRADO_NA_PASTA', 'SEM_PERMISSAO', 'A_CONFERIR']);
const ERROS_ACHADO = ['DRIVE_404', 'DRIVE_403', 'LIXEIRA', 'FORA_DA_PASTA'];

function useJanela() {
  const { configuracoes } = useSupervisao();
  const n = Number(configuracoes.find(c => c.chave === 'janela_documentos_dias')?.valor);
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : JANELA_DOCUMENTOS_PADRAO_DIAS;
}

const Linha: React.FC<{ d: DocumentoMonitorado; titular: string; coletivo?: boolean }> = ({ d, titular, coletivo }) => (
  <li className="p-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="documento-drive">
    <div className="min-w-[10rem] flex-1">
      <div className="font-semibold text-slate-900">{titular}{coletivo && <span className="ml-1.5 font-normal text-indigo-700">· documento coletivo do grupo</span>}</div>
      <div className="text-slate-500">{d.rotulo}</div>
    </div>
    <span className={`px-2 py-0.5 rounded border font-semibold ${ESTILO[d.situacao]}`}>{ROTULO_SITUACAO[d.situacao]}</span>
    <div className="text-slate-500 leading-tight">
      <div>Alterado: {dataCurta(d.modificadoEm)}</div>
      <div>Verificado: {dataCurta(d.consultadoEm)}</div>
    </div>
    {d.erro && !ERROS_ACHADO.includes(d.erro) && <span className="text-red-700 font-medium">Erro na consulta: {d.erro}</span>}
    {d.validacaoManual && <span className="text-slate-500">Validação manual: {d.validacaoManual}</span>}
  </li>
);

interface EstadoServidor { ligada: boolean; em_andamento: boolean; janela_dias: number; agendamentos: { cron: string; horario_brasilia: string }[]; historico: { status: string; modo: string; fim: string; lidos: number; atualizados: number; erros: Record<string, number>; mensagem?: string }[] }

/** Última execução + botão "Sincronizar agora" (somente a professora administradora). */
export const SincronizacaoDocumentos: React.FC = () => {
  const { perfilServidor, sincronizarAgora } = useSupervisao();
  const [estado, setEstado] = useState<EstadoServidor | null>(null);
  const [msg, setMsg] = useState('');
  const [rodando, setRodando] = useState(false);
  const admin = perfilServidor?.papel === 'PROFESSORA_ADMIN';
  const podeVer = admin || perfilServidor?.operacoes.includes('DOCUMENTOS_VER');
  const carregar = async () => { try { const r = await chamarServidor('/api/documentos/estado'); if (r.status === 200) setEstado(r.corpo); } catch { /* sem servidor: só os dados da planilha */ } };
  useEffect(() => { if (podeVer) void carregar(); }, [podeVer]);
  if (!podeVer) return null;
  const ult = estado?.historico?.[0];
  const sincronizar = async () => {
    setRodando(true); setMsg('');
    try {
      const r = await chamarServidor('/api/documentos/sincronizar', 'POST');
      if (r.status === 200 && r.corpo?.ok) {
        const x = r.corpo.resultado;
        setMsg(x.status === 'SUCESSO' ? `Sincronizado: ${x.lidos} documento(s) consultado(s), ${x.atualizados} atualizado(s).` : x.status === 'PARCIAL' ? `Sincronização parcial: ${Object.entries(x.erros).map(([c, n]) => `${c}×${n}`).join(', ')}.` : `Falhou: ${x.mensagem ?? 'ver histórico'}.`);
        void sincronizarAgora();
      } else setMsg(r.corpo?.message || `Não foi possível sincronizar (${r.status}).`);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Sem conexão com o servidor.'); }
    finally { setRodando(false); await carregar(); }
  };
  return (
    <div className="text-xs space-y-1" data-testid="sincronizacao-documentos">
      <div className="flex flex-wrap items-center gap-2">
        {ult ? <span className="text-slate-600">Última sincronização: {dataCurta(ult.fim)} · {ult.modo === 'AGENDADO' ? 'automática' : 'manual'} · {ult.status === 'SUCESSO' ? 'concluída' : ult.status === 'PARCIAL' ? 'parcial' : 'falhou'}</span> : <span className="text-slate-500">Nenhuma sincronização registrada neste servidor.</span>}
        {estado && estado.agendamentos.length > 0 && <span className="text-slate-500">Automática: {estado.agendamentos.map(a => a.horario_brasilia).join(' e ')} (Brasília){estado.ligada ? '' : ' — desligada'}</span>}
        {admin && (
          <button type="button" onClick={() => void sincronizar()} disabled={rodando || estado?.ligada === false}
            title={estado?.ligada === false ? 'Sincronização desligada neste ambiente (SINCRONIZACAO_DOCUMENTOS).' : 'Consulta apenas metadados no Drive'}
            className="ml-auto min-h-[36px] px-3 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${rodando ? 'animate-spin' : ''}`} /> {rodando ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        )}
      </div>
      {ult && ult.status !== 'SUCESSO' && <p className="text-amber-800 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> {ult.mensagem || Object.entries(ult.erros).map(([c, n]) => `${c}×${n}`).join(', ')}</p>}
      {msg && <p role="status" className="text-slate-700">{msg}</p>}
    </div>
  );
};

/** Documentos da turma: Clínica Ampliada = um por grupo; Consultoria = um por estudante. */
export const DocumentosDriveTurma: React.FC<{ turmaId: string }> = ({ turmaId }) => {
  const { monitoramentoDocumentos, getAlunosDaTurma, gruposPratica } = useSupervisao();
  const janela = useJanela();
  const agora = useMemo(() => new Date(), []);
  const alunos = getAlunosDaTurma(turmaId);
  const grupos = gruposPratica.filter(g => g.turma_id === turmaId);
  const docs = useMemo(() => documentosDaTurma(monitoramentoDocumentos, turmaId, { matriculasDaTurma: alunos.map(a => a.matricula), gruposDaTurma: grupos }, agora, janela),
    [monitoramentoDocumentos, turmaId, alunos.length, grupos.length, janela, agora]);
  if (!monitoramentoDocumentos.length || !docs.length) return null;
  const nomeAluno = new Map(alunos.map(a => [a.matricula.matricula_id, a.aluno.nome]));
  const nomeGrupo = new Map(grupos.map(g => [g.grupo_id, g.nome_grupo || 'Grupo']));
  const r = resumirMonitoramento(docs, agora);
  const conferir = docs.filter(d => PRECISA_CONFERIR.has(d.situacao) || (d.erro && !ERROS_ACHADO.includes(d.erro)));
  const ordenados = [...docs].sort((a, b) => Number(PRECISA_CONFERIR.has(b.situacao)) - Number(PRECISA_CONFERIR.has(a.situacao)));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5" data-testid="documentos-drive-turma">
      <div className="flex items-start gap-2">
        <FolderSearch className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-900">Documentos no Drive (somente metadados)</h3>
          <p className="text-[11px] text-slate-500">{AVISO_MODIFICACAO} “Alterado recentemente” = modificado nos últimos {janela} dias.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {(Object.keys(ROTULO_SITUACAO) as SituacaoDrive[]).filter(k => r.porSituacao[k] > 0).map(k => (
          <span key={k} className={`px-2 py-0.5 rounded border font-semibold ${ESTILO[k]}`}>{r.porSituacao[k]} · {ROTULO_SITUACAO[k]}</span>
        ))}
      </div>
      {(conferir.length > 0 || r.desatualizados > 0) && (
        <p className="text-xs text-amber-900 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2" role="status">
          <CloudOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{conferir.length > 0 && `${conferir.length} documento(s) a conferir. `}{r.desatualizados > 0 && `${r.desatualizados} sem verificação nas últimas 36 h (a sincronização pode estar parada).`}</span>
        </p>
      )}
      <SincronizacaoDocumentos />
      <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
        {ordenados.map(d => <Linha key={d.id} d={d} coletivo={d.titularTipo === 'GRUPO'}
          titular={d.titularTipo === 'GRUPO' ? (nomeGrupo.get(d.titularId) ?? 'Grupo não localizado') : (nomeAluno.get(d.titularId) ?? 'Matrícula não localizada')} />)}
      </ul>
    </section>
  );
};

/** Documentos de um estudante: os individuais da matrícula e o do grupo (sem duplicar). */
export const DocumentosDriveFicha: React.FC<{ matriculaId: string }> = ({ matriculaId }) => {
  const { monitoramentoDocumentos, grupoIntegrantes, gruposPratica } = useSupervisao();
  const janela = useJanela();
  const agora = useMemo(() => new Date(), []);
  const meusGrupos = grupoIntegrantes.filter(i => i.matricula_id === matriculaId).map(i => i.grupo_id);
  const { individuais, coletivos } = useMemo(() => documentosDoEstudante(monitoramentoDocumentos, matriculaId, meusGrupos, agora, janela), [monitoramentoDocumentos, matriculaId, meusGrupos.join(','), janela, agora]);
  if (!individuais.length && !coletivos.length) return null;
  const nomeGrupo = (id: string) => gruposPratica.find(g => g.grupo_id === id)?.nome_grupo || 'Grupo';
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2" data-testid="documentos-drive-ficha">
      <div className="flex items-center gap-2"><FileClock className="w-4 h-4 text-slate-500" /><h3 className="text-sm font-bold text-slate-900">Documentos no Drive (somente metadados)</h3></div>
      <p className="text-[11px] text-slate-500">{AVISO_MODIFICACAO}</p>
      <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
        {individuais.map(d => <Linha key={d.id} d={d} titular="Documento individual" />)}
        {coletivos.map(d => <Linha key={d.id} d={d} coletivo titular={nomeGrupo(d.titularId)} />)}
      </ul>
      {[...individuais, ...coletivos].some(d => PRECISA_CONFERIR.has(d.situacao)) && <p className="text-xs text-amber-900 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Há situação a conferir; consulte o Drive diretamente.</p>}
    </section>
  );
};
