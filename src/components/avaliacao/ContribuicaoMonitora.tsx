import { useState, useRef, useEffect } from 'react';
import { carregarFilaSincronizacao } from '../../services/indexedDbService';
import { useSupervisao } from '../../context/SupervisaoContext';
import { evidenciaParaLinha, linhaParaEvidencia, type EvidenciaAvaliacao, type PolaridadeEvidencia } from '../../services/estruturaAvaliacao';
import { mensagemErroAvaliacao } from './useDadosAvaliacao';

const TIPOS: Record<PolaridadeEvidencia, string> = { POSITIVO: 'Ponto forte', DESENVOLVER: 'Lacuna observada', NEUTRO: 'Pendência ou sugestão' };

/** Contribuição qualitativa PRELIMINAR da monitora. Não vê nem altera notas; a professora decide se usa. Regras também no servidor. */
export default function ContribuicaoMonitora({ matriculaId, turmaId, periodoId, email }: { matriculaId: string; turmaId: string; periodoId: string; email: string }) {
  const { evidenciasAvaliacao, salvarLinhaAvaliacao, syncStatusState } = useSupervisao();
  const [tipo, setTipo] = useState<PolaridadeEvidencia>('POSITIVO');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [pendente, setPendente] = useState(false);
  const pendenteAnterior = useRef(false);
  useEffect(() => {
    let ativo = true;
    void carregarFilaSincronizacao().then(fila => { if (ativo) {
      const existe = fila.some(i => i.tabela === 'evidencias_avaliacao' && i.payload.matricula_id === matriculaId && i.payload.origem === 'CONTRIBUICAO_MONITORA' && String(i.payload.responsavel).toLowerCase() === email.toLowerCase());
      if (pendenteAnterior.current && !existe) { setMensagem('Nenhum envio pendente para esta matrícula. Consulte os registros antes de reenviar.');setErro(''); }
      pendenteAnterior.current = existe;setPendente(existe);
    } }).catch(() => {if (ativo) setErro('Não foi possível verificar os envios pendentes.');});
    return () => { ativo = false; };
  }, [syncStatusState, matriculaId, email]);
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const minhas = evidenciasAvaliacao.map(linhaParaEvidencia).filter(e => e.matricula_id === matriculaId && e.origem === 'CONTRIBUICAO_MONITORA' && e.responsavel.toLowerCase() === email.toLowerCase());
  const enviar = async () => {
    if (enviando.current || pendente) return;
    setErro('');setMensagem('');
    if (!texto.trim() || texto.length > 600) { setErro('Escreva de 1 a 600 caracteres, de forma objetiva.'); return; }
    enviando.current = true;setOcupado(true);
    const agora = new Date().toISOString();
    const ev: EvidenciaAvaliacao = { evidencia_id: `EV-${crypto.randomUUID()}`, periodo_id: periodoId, turma_id: turmaId, matricula_id: matriculaId, data: agora.slice(0, 10),
      origem: 'CONTRIBUICAO_MONITORA', polaridade: tipo, observacao: texto.trim(), responsavel: email.toLowerCase(), preliminar: true, criado_em: agora, atualizado_em: agora };
    try {
      await salvarLinhaAvaliacao('evidencias_avaliacao', evidenciaParaLinha(ev));
      const item = (await carregarFilaSincronizacao()).find(i => i.tabela === 'evidencias_avaliacao' && i.payload.evidencia_id === ev.evidencia_id);
      if (item) { pendenteAnterior.current = true;setPendente(true);setMensagem('Contribuição pendente neste dispositivo. Confira a sincronização antes de reenviar.');if (item.erro) setErro(item.erro); }
      else { setTexto('');setMensagem('Contribuição confirmada no servidor.'); }
    } catch (e) { setErro(mensagemErroAvaliacao(e)); } finally { enviando.current = false;setOcupado(false); }
  };
  return (
    <section aria-label="Contribuição da monitora" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-bold text-slate-900">Contribuição para a avaliação (preliminar)</h3>
      <p className="text-xs text-slate-500">Registre pontos fortes, lacunas ou pendências documentais, de forma objetiva. Não inclua conteúdo clínico. A professora decide se usa.</p>
      <label className="block text-xs text-slate-600">Tipo
        <select value={tipo} onChange={e => setTipo(e.target.value as PolaridadeEvidencia)} className="mt-1 w-full min-h-[44px]! rounded-lg border border-slate-300 px-3 text-sm">
          {(Object.keys(TIPOS) as PolaridadeEvidencia[]).map(t => <option key={t} value={t}>{TIPOS[t]}</option>)}
        </select>
      </label>
      <textarea disabled={ocupado || pendente} aria-label="Contribuição" value={texto} onChange={e => setTexto(e.target.value)} rows={3} maxLength={600} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      {mensagem && <p role="status" className="prisma-meta">{mensagem}</p>}
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      <button disabled={ocupado || pendente} onClick={enviar} className="min-h-[44px]! rounded-lg cs-primary-action px-4 text-sm font-semibold text-white">{ocupado ? 'Registrando…' : pendente ? 'Envio pendente' : 'Enviar contribuição'}</button>
      {minhas.length > 0 && <ul className="space-y-1 text-xs text-slate-700">{minhas.map(e => <li key={e.evidencia_id} className="rounded-lg bg-slate-50 p-2">{e.observacao} <span className="text-slate-400">· {e.preliminar ? 'preliminar' : 'aproveitada'}</span></li>)}</ul>}
    </section>
  );
}
