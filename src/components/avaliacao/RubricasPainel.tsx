import { mensagemErroAvaliacao } from './useDadosAvaliacao';
import { useMemo, useState } from 'react';
import { useSupervisao } from '../../context/SupervisaoContext';
import type { Avaliacao, CriterioAvaliacao } from '../../types';
import { formatarPontos, type NivelDesempenho } from '../../services/avaliacaoEngine';
import {
  sugerirClassificacaoCriterio, NIVEIS, ROTULO_NIVEL, DESCRICAO_NIVEL, criarRubricaDocumentacao, validarRubrica, novaVersaoRubrica, aprovarRubrica, novoRascunho, selecionarNivel,
  ajustarPontuacao, comentarSubcriterio, pontuacaoSugerida, prepararConfirmacao, marcarConfirmada, descritorDoNivel, subsidioDoGrupo, adotarSubsidio, sugerirTipoEstagio,
  type RascunhoAvaliacao, type RubricaVersao, type TipoEstagio,
} from '../../services/rubricasAvaliacao';
import { configParaLinha, rascunhoParaLinha, rubricaParaLinha, type ConfigAvaliacao } from '../../services/estruturaAvaliacao';

const ROTULO_ESTAGIO: Record<TipoEstagio, string> = {
  CLINICA_ADULTO: 'Clínica Adulto', CLINICA_AMPLIADA: 'Clínica Ampliada', CONSULTORIA_ORGANIZACIONAL: 'Consultoria Organizacional (descritores a definir)', OUTRO: 'Outro (sem foco específico)',
};
const COR_NIVEL: Record<NivelDesempenho, string> = {
  EXCELENTE: 'border-emerald-400 bg-emerald-50 text-emerald-900', ADEQUADO: 'border-teal-400 bg-teal-50 text-teal-900', PARCIAL: 'border-amber-400 bg-amber-50 text-amber-900',
  INSUFICIENTE: 'border-orange-400 bg-orange-50 text-orange-900', NAO_ATENDIDO: 'border-red-400 bg-red-50 text-red-900', NAO_AVALIADO: 'border-slate-400 bg-slate-100 text-slate-800',
};

interface Props {
  criterios: CriterioAvaliacao[];
  configs: ConfigAvaliacao[];
  rubricas: RubricaVersao[];
  rascunhos: RascunhoAvaliacao[];
  oficiais: Avaliacao[];
  matriculaId: string;
  turmaId: string;
  turmaNome: string;
  periodoId: string;
  grupoId?: string;
  emailProfessora: string;
}

const rubricaVigente = (rubricas: RubricaVersao[], rubricaId: string) =>
  rubricas.filter(r => r.rubrica_id === rubricaId && r.status === 'aprovada').sort((a, b) => b.versao - a.versao)[0] ?? null;

export default function RubricasPainel({ criterios, configs, rubricas, rascunhos, oficiais, matriculaId, turmaId, turmaNome, periodoId, grupoId, emailProfessora }: Props) {
  const { salvarLinhaAvaliacao, saveAvaliacao } = useSupervisao();
  const [criterioId, setCriterioId] = useState((criterios.find(c => /^DOCUMENTACAO/i.test(String(c.codigo_criterio ?? ''))) ?? criterios[0])?.criterio_id ?? '');
  const [alvoGrupo, setAlvoGrupo] = useState(false);
  const [escalar, setEscalar] = useState(false);
  const [estagio, setEstagio] = useState<TipoEstagio>(sugerirTipoEstagio(turmaNome) ?? 'OUTRO');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [pesosEdicao, setPesosEdicao] = useState<Record<string, string> | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ajustes, setAjustes] = useState<Record<string, { nota: string; just: string }>>({});

  const criterio = criterios.find(c => c.criterio_id === criterioId);
  const maxCriterio = Number(criterio?.nota_maxima) || 0;
  const config = useMemo(() => configs.filter(c => c.criterio_id === criterioId && c.status === 'aprovada').sort((a, b) => b.versao - a.versao)[0] ?? null, [configs, criterioId]);
  const rubrica = config?.rubrica_id ? rubricaVigente(rubricas, config.rubrica_id) : null;
  const rubricaPendente = config?.rubrica_id ? rubricas.filter(r => r.rubrica_id === config.rubrica_id && r.status !== 'aprovada').sort((a, b) => b.versao - a.versao)[0] ?? null : null;
  const matriculaAlvo = alvoGrupo && grupoId ? `GRUPO:${grupoId}` : matriculaId;
  const rascunhoAtual = rascunhos
    .filter(r => r.criterio_id === criterioId && r.matricula_id === matriculaAlvo && (!rubrica || r.rubrica_id === rubrica.rubrica_id))
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))[0] ?? null;
  const rubricaDoRascunho = rascunhoAtual ? rubricas.find(r => r.rubrica_id === rascunhoAtual.rubrica_id && r.versao === rascunhoAtual.rubrica_versao) ?? rubrica : rubrica;
  const coletivo = grupoId ? rascunhos.find(r => r.criterio_id === criterioId && r.escopo === 'COLETIVA' && r.matricula_id === `GRUPO:${grupoId}`) ?? null : null;
  const oficial = oficiais.find(o => o.criterio_id === criterioId);

  const executar = async (fn: () => Promise<void>) => {
    setErro(''); setOcupado(true);
    try { await fn(); } catch (e) { setErro(mensagemErroAvaliacao(e)); } finally { setOcupado(false); }
  };
  const agora = () => new Date().toISOString();
  const gravarRascunho = (r: RascunhoAvaliacao) => salvarLinhaAvaliacao('avaliacao_rascunhos', rascunhoParaLinha(r, turmaId, emailProfessora));
  const garantirRascunho = (): RascunhoAvaliacao => {
    if (rascunhoAtual && rascunhoAtual.status === 'RASCUNHO') return rascunhoAtual;
    if (!rubrica) throw new Error('Não há versão aprovada da rubrica.');
    return novoRascunho({ rascunhoId: `RAS-${crypto.randomUUID()}`, matriculaId: matriculaAlvo, grupoId: alvoGrupo ? grupoId : undefined,
      escopo: alvoGrupo ? 'COLETIVA' : 'INDIVIDUAL', rubrica, agora: agora(), por: emailProfessora });
  };

  const configurar = () => executar(async () => {
    if (!criterio) return;
    let rub = criarRubricaDocumentacao({ tipoEstagio: estagio, criterioId, turmaId, periodoId, criadoPor: emailProfessora, agora: agora() });
    if (Math.abs(rub.peso_total - maxCriterio) > 1e-9) {
      if (!escalar) throw new Error(`Este critério vale ${formatarPontos(maxCriterio)} e o modelo de Documentação soma ${formatarPontos(rub.peso_total)}. Marque "ajustar pesos proporcionalmente" ou escolha o critério de ${formatarPontos(rub.peso_total)}.`);
      const fator = maxCriterio / rub.peso_total;
      const subs = rub.subcriterios.map(s => ({ ...s, peso: Math.round(s.peso * fator * 10000) / 10000 }));
      const resto = Math.round((maxCriterio - subs.reduce((a, s) => a + s.peso, 0)) * 10000) / 10000;
      subs[0] = { ...subs[0], peso: Math.round((subs[0].peso + resto) * 10000) / 10000 }; // o maior peso absorve o arredondamento
      rub = { ...rub, subcriterios: subs, peso_total: maxCriterio, origem: rub.origem + '_pesos_proporcionais' };
    }
    const problemas = validarRubrica(rub, maxCriterio);
    if (problemas.length) throw new Error(problemas.map(p => p.mensagem).join(' '));
    await salvarLinhaAvaliacao('rubricas_avaliacao', rubricaParaLinha(rub));
    const cfg: ConfigAvaliacao = { config_id: `CFG-${turmaId}-${criterioId}-${periodoId}-v1`, periodo_id: periodoId, turma_id: turmaId, criterio_id: criterioId, versao: 1,
      status: rub.status === 'aprovada' ? 'aprovada' : 'rascunho', tipo_calculo: 'hybrid', tipo_estagio: estagio, config: { agregacao: 'soma' }, rubrica_id: rub.rubrica_id,
      criado_em: agora(), criado_por: emailProfessora, ...(rub.status === 'aprovada' ? { aprovado_em: agora(), aprovado_por: emailProfessora } : {}) };
    await salvarLinhaAvaliacao('config_avaliacao', configParaLinha(cfg));
  });

  const escolherNivel = (subId: string, nivel: NivelDesempenho) => executar(async () => gravarRascunho(selecionarNivel(garantirRascunho(), subId, nivel, emailProfessora, agora())));
  const ajustar = (subId: string) => executar(async () => {
    const a = ajustes[subId]; if (!a) return;
    gravarRascunho(ajustarPontuacao(garantirRascunho(), subId, Number(a.nota.replace(',', '.')), a.just, emailProfessora, agora()));
    setAjustes(x => { const { [subId]: _, ...resto } = x; return resto; });
  });
  const comentar = (subId: string, texto: string) => executar(async () => { if (rascunhoAtual?.selecoes.find(s => s.subcriterio_id === subId)?.comentario === texto) return; await gravarRascunho(comentarSubcriterio(garantirRascunho(), subId, texto, emailProfessora, agora())); });
  const adotar = (subId: string) => executar(async () => {
    if (!coletivo) return;
    const sug = subsidioDoGrupo(coletivo, matriculaId, [matriculaId]).find(s => s.subcriterio_id === subId);
    if (sug) await gravarRascunho(adotarSubsidio(garantirRascunho(), sug, emailProfessora, agora()));
  });
  const novaRevisao = () => executar(async () => {
    if (!rubrica || !rascunhoAtual) return;
    let r = novoRascunho({ rascunhoId: `RAS-${crypto.randomUUID()}`, matriculaId: matriculaAlvo, grupoId: alvoGrupo ? grupoId : undefined, escopo: alvoGrupo ? 'COLETIVA' : 'INDIVIDUAL', rubrica, agora: agora(), por: emailProfessora });
    for (const s of rascunhoAtual.selecoes) if (s.subcriterio_id in r.pesos && !s.ajuste) r = selecionarNivel(r, s.subcriterio_id, s.nivel, emailProfessora, agora());
    await gravarRascunho(r);
  });

  const salvarPesos = () => executar(async () => {
    const base = rubrica; if (!base || !pesosEdicao) return;
    const subs = base.subcriterios.map(s => ({ ...s, peso: Number((pesosEdicao[s.subcriterio_id] ?? String(s.peso)).replace(',', '.')) }));
    const nova = novaVersaoRubrica(base, { subcriterios: subs, criadoPor: emailProfessora, agora: agora(), motivo, valorCriterio: maxCriterio });
    await salvarLinhaAvaliacao('rubricas_avaliacao', rubricaParaLinha(nova));
    setPesosEdicao(null); setMotivo('');
  });
  const aprovarVersao = () => executar(async () => { if (rubricaPendente) await salvarLinhaAvaliacao('rubricas_avaliacao', rubricaParaLinha(aprovarRubrica(rubricaPendente, emailProfessora, agora()))); });

  const sugestao = rubricaDoRascunho && rascunhoAtual ? pontuacaoSugerida(rubricaDoRascunho, rascunhoAtual) : null;
  const confirmacao = rubricaDoRascunho && rascunhoAtual && !alvoGrupo ? prepararConfirmacao(rubricaDoRascunho, rascunhoAtual, oficial ? Number(oficial.nota) : null) : null;
  const notaProposta = confirmacao?.notaProposta !== null && confirmacao?.notaProposta !== undefined ? Math.round(confirmacao.notaProposta * 100) / 100 : null;

  const confirmarNota = () => executar(async () => {
    if (!rascunhoAtual || !rubricaDoRascunho || notaProposta === null || !aceite) return;
    await saveAvaliacao(matriculaId, criterioId, notaProposta, oficial?.observacao ?? '');
    await gravarRascunho(marcarConfirmada(rascunhoAtual, emailProfessora, agora()));
    setConfirmando(false); setAceite(false);
  });

  if (!criterios.length) return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500">Esta turma não tem critérios cadastrados em criterios_avaliacao.</p>;
  const bloqueado = rascunhoAtual?.status === 'CONFIRMADA';

  return (
    <div className="space-y-4" aria-label="Rubricas">
      <label className="block text-xs text-slate-600">Critério
        <select value={criterioId} onChange={e => { setCriterioId(e.target.value); setAlvoGrupo(false); setConfirmando(false); }} className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm">
          {criterios.map(c => <option key={c.criterio_id} value={c.criterio_id}>{c.nome} (valor {formatarPontos(Number(c.nota_maxima) || 0)})</option>)}
        </select>
      </label>
      {criterio && sugerirClassificacaoCriterio(criterio) && (
        <p className="text-xs text-slate-500">Sugestão (não aplicada): {sugerirClassificacaoCriterio(criterio)!.tipo} — {sugerirClassificacaoCriterio(criterio)!.observacao}.</p>
      )}
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{erro}</p>}

      {!config && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-sm text-slate-800">Este critério é lançado <strong>manualmente</strong> (nota oficial da planilha). Nenhuma fórmula é aplicada por semelhança de nome.</p>
          <p className="text-xs text-slate-500">Para usar a rubrica de Documentação (6 subcritérios, 2,50), escolha o tipo de estágio e configure. A nota oficial só muda quando você confirmar.</p>
          <label className="block text-xs text-slate-600">Tipo de estágio
            <select value={estagio} onChange={e => setEstagio(e.target.value as TipoEstagio)} className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm">
              {(Object.keys(ROTULO_ESTAGIO) as TipoEstagio[]).map(t => <option key={t} value={t}>{ROTULO_ESTAGIO[t]}</option>)}
            </select>
          </label>
          {Math.abs(maxCriterio - 2.5) > 1e-9 && (
            <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={escalar} onChange={e => setEscalar(e.target.checked)} className="mt-0.5 h-5 w-5" />Este critério vale {formatarPontos(maxCriterio)}: ajustar os pesos do modelo (2,50) proporcionalmente.</label>
          )}
          <button onClick={configurar} disabled={ocupado} className="min-h-[44px] rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Configurar rubrica neste critério</button>
        </div>
      )}

      {config && !rubrica && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          A rubrica deste critério ainda não foi aprovada{config.tipo_estagio === 'CONSULTORIA_ORGANIZACIONAL' ? ' e os descritores da Consultoria Organizacional estão por definir' : ''}. A nota oficial continua manual.
          {rubricaPendente && <button onClick={aprovarVersao} className="ml-2 min-h-[44px] rounded-lg border border-amber-500 px-3 text-xs font-semibold">Aprovar versão {rubricaPendente.versao}</button>}
        </div>
      )}

      {config && rubrica && (
        <>
          {grupoId && (
            <div role="tablist" aria-label="Alvo da avaliação" className="inline-flex rounded-lg border border-slate-300 p-0.5 text-xs">
              <button role="tab" aria-selected={!alvoGrupo} onClick={() => setAlvoGrupo(false)} className={`min-h-[44px] rounded-md px-3 ${!alvoGrupo ? 'bg-slate-800 text-white' : 'text-slate-700'}`}>Individual</button>
              <button role="tab" aria-selected={alvoGrupo} onClick={() => setAlvoGrupo(true)} className={`min-h-[44px] rounded-md px-3 ${alvoGrupo ? 'bg-slate-800 text-white' : 'text-slate-700'}`}>Documento do grupo</button>
            </div>
          )}
          {alvoGrupo && <p className="text-xs text-slate-600">Avaliação do documento coletivo. Ela <strong>não gera a mesma nota</strong> para todos: serve de sugestão que você adota, item a item, na avaliação individual.</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>Rubrica v{(rubricaDoRascunho ?? rubrica).versao} · {ROTULO_ESTAGIO[rubrica.tipo_estagio]}</span>
            {bloqueado && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">Confirmada — somente leitura</span>}
          </div>

          {(rubricaDoRascunho ?? rubrica).subcriterios.map(def => {
            const rb = rubricaDoRascunho ?? rubrica;
            const sel = rascunhoAtual?.selecoes.find(s => s.subcriterio_id === def.subcriterio_id);
            const sug = !alvoGrupo && coletivo ? coletivo.selecoes.find(s => s.subcriterio_id === def.subcriterio_id) : undefined;
            const peso = rascunhoAtual?.pesos[def.subcriterio_id] ?? def.peso;
            return (
              <fieldset key={def.subcriterio_id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2" disabled={bloqueado || ocupado}>
                <legend className="px-1 text-sm font-semibold text-slate-900">{def.nome} <span className="font-normal text-slate-500">(valor {formatarPontos(peso)})</span></legend>
                <details className="text-xs text-slate-600"><summary className="cursor-pointer">O que avaliar</summary><ul className="mt-1 list-disc pl-5">{def.foco.map(f => <li key={f}>{f}</li>)}</ul></details>
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Nível de ${def.nome}`}>
                  {NIVEIS.map(n => (
                    <button key={n} type="button" aria-pressed={sel?.nivel === n} onClick={() => escolherNivel(def.subcriterio_id, n)} title={DESCRICAO_NIVEL[n]}
                      className={`min-h-[44px] rounded-lg border px-3 text-xs font-semibold ${sel?.nivel === n ? COR_NIVEL[n] + ' ring-2 ring-offset-1 ring-slate-400' : 'border-slate-300 bg-white text-slate-700'}`}>
                      {ROTULO_NIVEL[n]}
                    </button>
                  ))}
                </div>
                {sel && sel.nivel !== 'NAO_AVALIADO' && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">{descritorDoNivel(rb, def.subcriterio_id, sel.nivel)}</p>}
                {sel?.ajuste && <p className="text-xs text-indigo-800">Ajuste manual: {formatarPontos(sel.ajuste.nota)} — {sel.ajuste.justificativa}</p>}
                {sug && !sel && <p className="text-xs text-indigo-800">Sugestão do documento do grupo: {ROTULO_NIVEL[sug.nivel]} <button onClick={() => adotar(def.subcriterio_id)} className="ml-2 min-h-[44px] rounded-lg border border-indigo-300 px-3 font-semibold">Adotar</button></p>}
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer">Ver os descritores de cada nível</summary>
                  <dl className="mt-1 space-y-1">{NIVEIS.filter(n => n !== 'NAO_AVALIADO').map(n => <div key={n}><dt className="font-semibold">{ROTULO_NIVEL[n]}</dt><dd>{descritorDoNivel(rb, def.subcriterio_id, n)}</dd></div>)}</dl>
                </details>
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer">Ajustar pontuação (exige justificativa)</summary>
                  <div className="mt-2 grid gap-2">
                    <input inputMode="decimal" aria-label={`Nota ajustada de ${def.nome}`} placeholder={`0 a ${formatarPontos(peso)}`} value={ajustes[def.subcriterio_id]?.nota ?? ''} onChange={e => setAjustes(a => ({ ...a, [def.subcriterio_id]: { nota: e.target.value, just: a[def.subcriterio_id]?.just ?? '' } }))} className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm" />
                    <textarea aria-label={`Justificativa do ajuste de ${def.nome}`} placeholder="Justificativa" rows={2} value={ajustes[def.subcriterio_id]?.just ?? ''} onChange={e => setAjustes(a => ({ ...a, [def.subcriterio_id]: { nota: a[def.subcriterio_id]?.nota ?? '', just: e.target.value } }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <button type="button" onClick={() => ajustar(def.subcriterio_id)} className="min-h-[44px] rounded-lg border border-slate-400 px-3 font-semibold">Aplicar ajuste</button>
                  </div>
                </details>
                <textarea aria-label={`Comentário sobre ${def.nome}`} placeholder="Comentário opcional (aparece na devolutiva)" rows={2} defaultValue={sel?.comentario ?? ''} onBlur={e => comentar(def.subcriterio_id, e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </fieldset>
            );
          })}

          {sugestao && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900" aria-live="polite">
              <p className="font-semibold">Pontuação sugerida (não é a nota oficial)</p>
              <p>{sugestao.total !== null ? `${formatarPontos(sugestao.total)} de ${formatarPontos((rubricaDoRascunho ?? rubrica).peso_total)}` : `Incompleta: ${sugestao.avaliados} de ${sugestao.total_subcriterios} subcritérios avaliados${sugestao.parcial !== null ? ` (soma parcial ${formatarPontos(sugestao.parcial)}, não é nota)` : ''}`}</p>
              <p className="text-xs">Nota oficial atual: {oficial ? formatarPontos(Number(oficial.nota)) : 'não lançada'}.</p>
            </div>
          )}

          {!alvoGrupo && rascunhoAtual && (
            <div className="space-y-2">
              {!bloqueado && <button onClick={() => { setConfirmando(true); setAceite(false); }} disabled={!confirmacao?.podeConfirmar || ocupado} className="min-h-[44px] w-full sm:w-auto rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-40">Revisar e confirmar nota</button>}
              {!bloqueado && confirmacao && !confirmacao.podeConfirmar && <p className="text-xs text-slate-500">{confirmacao.motivoBloqueio}</p>}
              {bloqueado && <button onClick={novaRevisao} disabled={ocupado} className="min-h-[44px] rounded-lg border border-slate-400 px-4 text-sm font-semibold">Iniciar nova revisão</button>}
            </div>
          )}

          {confirmando && confirmacao?.podeConfirmar && notaProposta !== null && (
            <div role="dialog" aria-modal="true" aria-label="Confirmar nota oficial" className="rounded-xl border-2 border-slate-800 bg-white p-4 space-y-3">
              <h4 className="text-sm font-bold text-slate-900">Conferência antes de gravar</h4>
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-slate-500">Nota proposta (2 casas)</dt><dd className="font-bold tabular-nums">{formatarPontos(notaProposta)}</dd>
                <dt className="text-slate-500">Nota oficial atual</dt><dd className="tabular-nums">{oficial ? formatarPontos(Number(oficial.nota)) : 'não lançada'}</dd>
                {confirmacao.diferenca !== null && <><dt className="text-slate-500">Diferença</dt><dd className="tabular-nums">{formatarPontos(confirmacao.diferenca)}</dd></>}
              </dl>
              {confirmacao.substituiOficial && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Esta ação substitui uma nota oficial já lançada. O valor anterior fica no log de alterações.</p>}
              <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-0.5 h-5 w-5" />Confirmo gravar esta nota como oficial neste critério.</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={confirmarNota} disabled={!aceite || ocupado} className="min-h-[44px] rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-40">Gravar nota oficial</button>
                <button onClick={() => setConfirmando(false)} className="min-h-[44px] rounded-lg border border-slate-400 px-4 text-sm">Cancelar</button>
              </div>
            </div>
          )}

          {rascunhoAtual && (
            <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold">Histórico de alterações ({rascunhoAtual.historico.length})</summary>
              <ol className="mt-2 space-y-1">{rascunhoAtual.historico.map((h, i) => (
                <li key={i}>{h.em.slice(0, 16).replace('T', ' ')} · {h.acao.toLowerCase().replaceAll('_', ' ')}{h.subcriterio_id ? ` · ${h.subcriterio_id}` : ''}{h.antes || h.depois ? ` · ${h.antes ?? '—'} → ${h.depois ?? '—'}` : ''}{h.motivo ? ` · ${h.motivo}` : ''}</li>
              ))}</ol>
            </details>
          )}

          <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">Editar pesos desta rubrica (cria nova versão)</summary>
            <p className="mt-1">Rascunhos já feitos continuam na versão em que foram criados. A nova versão só vale depois de aprovada.</p>
            {pesosEdicao ? (
              <div className="mt-2 space-y-2">
                {rubrica.subcriterios.map(s => (
                  <label key={s.subcriterio_id} className="flex items-center justify-between gap-2">{s.nome}
                    <input inputMode="decimal" value={pesosEdicao[s.subcriterio_id] ?? String(s.peso)} onChange={e => setPesosEdicao(p => ({ ...(p ?? {}), [s.subcriterio_id]: e.target.value }))} className="min-h-[44px] w-24 rounded-lg border border-slate-300 px-2 text-right" />
                  </label>
                ))}
                <input placeholder="Motivo da alteração" value={motivo} onChange={e => setMotivo(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3" />
                <div className="flex gap-2"><button onClick={salvarPesos} className="min-h-[44px] rounded-lg bg-slate-900 px-4 font-semibold text-white">Salvar nova versão</button><button onClick={() => setPesosEdicao(null)} className="min-h-[44px] rounded-lg border border-slate-400 px-4">Cancelar</button></div>
              </div>
            ) : <button onClick={() => setPesosEdicao({})} className="mt-2 min-h-[44px] rounded-lg border border-slate-400 px-4 font-semibold">Editar pesos</button>}
            {rubricaPendente && <button onClick={aprovarVersao} className="mt-2 min-h-[44px] rounded-lg border border-emerald-600 px-4 font-semibold text-emerald-800">Aprovar versão {rubricaPendente.versao}</button>}
          </details>
        </>
      )}
    </div>
  );
}
