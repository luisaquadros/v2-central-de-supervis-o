import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileUp, TriangleAlert } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { formatarDataBr } from '../services/supervisaoOperacionalService';
import type { PacoteImportacao, ResumoImportacao } from '../services/chamadaService';
import { Botao, Janela, Selo } from './ui';

/**
 * Importa registros em lote (ex.: caderno de chamada e notas transcrito).
 * Mostra a prévia antes de gravar; notas diferentes da planilha só mudam se a professora marcar.
 */
export const ImportarRegistrosModal: React.FC<{ aoFechar: () => void }> = ({ aoFechar }) => {
  const { previsualizarImportacao, importarRegistros, turmas } = useSupervisao();
  const [pacote, setPacote] = useState<PacoteImportacao | null>(null);
  const [erro, setErro] = useState('');
  const [substituir, setSubstituir] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const [feito, setFeito] = useState<ResumoImportacao | null>(null);
  const resumo = useMemo(() => (pacote ? previsualizarImportacao(pacote) : null), [pacote, previsualizarImportacao]);
  const nomeTurma = (id: string) => turmas.find(t => t.turma_id === id)?.nome || 'Turma';

  const abrirArquivo = async (arquivo?: File) => {
    setErro(''); setPacote(null); setFeito(null);
    if (!arquivo) return;
    try {
      const dados = JSON.parse(await arquivo.text());
      if (dados?.versao !== 1 || !Array.isArray(dados.chamadas ?? [])) throw new Error('formato');
      setPacote(dados);
    } catch {
      setErro('Este arquivo não é um pacote de importação da Central.');
    }
  };

  const importar = async () => {
    if (!pacote) return;
    setImportando(true);
    try { setFeito(await importarRegistros(pacote, [...substituir])); } finally { setImportando(false); }
  };

  const total = resumo ? resumo.aulas + resumo.semAula + resumo.notasNovas + substituir.size + resumo.entregasNovas + resumo.entregasAtualizadas + resumo.anotacoes : 0;

  return (
    <Janela titulo="Importar registros" subtitulo={pacote?.fonte || 'Frequência, notas e entregas de um arquivo .json'} aoFechar={aoFechar} largura="lg"
      rodape={feito ? <Botao variante="primario" onClick={aoFechar}>Fechar</Botao> : <>
        <Botao onClick={aoFechar}>Cancelar</Botao>
        {resumo && <Botao variante="primario" disabled={importando || total === 0} onClick={() => void importar()}>
          {importando ? 'Importando…' : `Importar ${total} item(ns)`}
        </Botao>}
      </>}>
      {feito ? (
        <div className="text-center py-6 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <p className="text-lg font-bold text-slate-900">Importação enviada para a planilha</p>
          <p className="text-slate-600">{feito.aulas} aula(s) com chamada, {feito.notasNovas + feito.notasAlteradas} nota(s), {feito.entregasNovas + feito.entregasAtualizadas} entrega(s). O selo do topo mostra quando tudo estiver salvo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center gap-3 border-2 border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:bg-slate-50">
            <FileUp className="w-6 h-6 text-slate-500" />
            <span className="text-slate-700">{pacote ? 'Trocar arquivo' : 'Escolher o arquivo de importação (.json)'}</span>
            <input type="file" accept=".json,application/json" className="hidden" onChange={e => void abrirArquivo(e.target.files?.[0])} />
          </label>
          {erro && <p className="text-red-700">{erro}</p>}

          {resumo && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['Aulas com chamada', resumo.aulas], ['Presenças', resumo.presencas], ['Faltas', resumo.faltas], ['Ocorrências', resumo.ocorrencias],
                  ['Notas novas', resumo.notasNovas], ['Notas iguais', resumo.notasIguais], ['Entregas', resumo.entregasNovas + resumo.entregasAtualizadas],
                  ['Apresentações confirmadas', resumo.apresentacoesConfirmadas],
                ].map(([rotulo, n]) => (
                  <div key={rotulo as string} className="bg-slate-50 rounded-xl p-2 text-center">
                    <p className="text-xl font-black text-slate-900">{n as number}</p>
                    <p className="text-xs text-slate-600">{rotulo as string}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-600">
                Gravar de novo o mesmo arquivo não duplica nada: presença, ocorrência e entrega têm identificação fixa por estudante e data.
              </p>

              {resumo.notasDiferentes.length > 0 && (
                <section className="border border-amber-300 bg-amber-50 rounded-xl p-3">
                  <h3 className="font-bold text-amber-900 flex items-center gap-2"><TriangleAlert className="w-4 h-4" /> Notas diferentes da planilha ({resumo.notasDiferentes.length})</h3>
                  <p className="text-sm text-amber-900 mb-2">Por padrão a planilha fica como está. Marque só as que devem ser trocadas pelo valor do arquivo.</p>
                  <ul className="space-y-1">
                    {resumo.notasDiferentes.map(n => (
                      <li key={n.chave}>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={substituir.has(n.chave)}
                            onChange={e => setSubstituir(s => { const x = new Set(s); if (e.target.checked) x.add(n.chave); else x.delete(n.chave); return x; })} />
                          <span className="flex-1"><strong>{n.nome}</strong> <span className="text-slate-500">· {nomeTurma(n.turma_id)} · {n.criterio}</span></span>
                          <span>planilha <strong>{n.planilha}</strong> → arquivo <strong>{n.caderno}</strong></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {resumo.paraConferir.length > 0 && (
                <section>
                  <h3 className="font-bold text-slate-900">Leituras incertas para conferir depois ({resumo.paraConferir.length})</h3>
                  <ul className="text-sm text-slate-700">
                    {resumo.paraConferir.map((p, i) => <li key={i}>{formatarDataBr(p.data)} · {nomeTurma(p.turma_id)} · <strong>{p.nome}</strong>: {p.observacao}</li>)}
                  </ul>
                </section>
              )}

              {resumo.agendaDiferente.length > 0 ? (
                <section>
                  <h3 className="font-bold text-slate-900">Agenda de apresentações diferente da planilha ({resumo.agendaDiferente.length})</h3>
                  <ul className="text-sm text-slate-700">
                    {resumo.agendaDiferente.map((a, i) => <li key={i}><strong>{a.nome}</strong> · {nomeTurma(a.turma_id)}: arquivo {formatarDataBr(a.dataCaderno)}, planilha {a.dataPlanilha}</li>)}
                  </ul>
                </section>
              ) : (pacote?.apresentacoes?.length ?? 0) > 0 && (
                <p className="text-sm text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> A agenda de apresentações do arquivo bate com a planilha ({pacote!.apresentacoes!.length} apresentações).</p>
              )}

              {(resumo.semVinculo.length > 0 || resumo.avisos.length > 0) && (
                <section>
                  <h3 className="font-bold text-slate-900">Avisos</h3>
                  <ul className="text-sm text-slate-700 space-y-0.5">
                    {resumo.semVinculo.map((s, i) => <li key={`v${i}`}><Selo cor="cinza">não importado</Selo> <strong>{s.nome}</strong> · {nomeTurma(s.turma_id)}: {s.motivo}</li>)}
                    {resumo.avisos.map((a, i) => <li key={`a${i}`}>• {a}</li>)}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </Janela>
  );
};
