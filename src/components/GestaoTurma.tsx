import React from "react";
import QRCode from "qrcode";
import { useSupervisao } from "../context/SupervisaoContext";
import {
  lerCsv,
  prepararCronograma,
} from "../services/importacaoCronogramaService";
import type { MarcoAcademico } from "../types";

export function GestaoTurma({ turmaId }: { turmaId: string }) {
  const c = useSupervisao(),
    turma = c.turmas.find((t) => t.turma_id === turmaId);
  const [csv, setCsv] = React.useState(""),
    [marcos, setMarcos] = React.useState<MarcoAcademico[]>([]),
    [inscricoes, setInscricoes] = React.useState<
      { nome: string; identificador_academico: string; email: string }[]
    >([]);
  const [textoInscricoes, setTextoInscricoes] = React.useState(""),
    [link, setLink] = React.useState(""),
    [qr, setQr] = React.useState(""),
    [erro, setErro] = React.useState(""),
    [mensagem, setMensagem] = React.useState(""),
    [ocupado, setOcupado] = React.useState(false),
    [conferido, setConferido] = React.useState(false);
  const [nomeGrupo, setNomeGrupo] = React.useState(""),
    [dataGrupo, setDataGrupo] = React.useState(""),
    [grupoExistente, setGrupoExistente] = React.useState(""),
    [integrantes, setIntegrantes] = React.useState<string[]>([]);
  const [marcoEditar,setMarcoEditar]=React.useState<MarcoAcademico|null>(null), [dataMarco,setDataMarco]=React.useState("");
  const busy = React.useRef(false);
  const [rubricaConferida, setRubricaConferida] = React.useState(false);
  if (!turma || c.perfilServidor?.papel !== "PROFESSORA_ADMIN") return null;
  const historico =
    c.periodos.find((p) => p.periodo_id === turma.periodo_id)?.status ===
    "ARQUIVADO";
  const pendentes = c.matriculas.filter(
    (m) => m.turma_id === turmaId && m.status === "PENDENTE",
  );
  async function executar(fn: () => Promise<void> | void) {
    if (busy.current) return;
    busy.current = true;
    setOcupado(true);
    setErro("");
    setMensagem("");
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      busy.current = false;
      setOcupado(false);
    }
  }
  return (
    <section className="space-y-3" aria-label="Gestão acadêmica da turma">
      {erro && (
        <p role="alert" className="prisma-section text-red-700">
          {erro}
        </p>
      )}
      {mensagem && (
        <p role="status" className="prisma-section">
          {mensagem}
        </p>
      )}
      {c.criterios.some(
        (cr) => cr.turma_id === turmaId && cr.status_validacao === "A_CONFERIR",
      ) && (
        <details className="prisma-section">
          <summary>Conferir rubrica herdada</summary>
          <ul className="text-sm space-y-2 mt-3">
            {c.criterios
              .filter((cr) => cr.turma_id === turmaId)
              .map((cr) => (
                <li key={cr.criterio_id}>
                  {cr.nome} · máximo {String(cr.nota_maxima ?? "não informado")}{" "}
                  · peso {String(cr.peso ?? "não informado")}
                </li>
              ))}
          </ul>
          <label className="flex gap-2 mt-3 text-sm">
            <input
              type="checkbox"
              checked={rubricaConferida}
              onChange={(e) => setRubricaConferida(e.target.checked)}
            />
            <span>
              Conferi estes critérios e pesos com a rubrica oficial para esta
              turma.
            </span>
          </label>
          <button
            disabled={!rubricaConferida || ocupado || historico}
            className="cs-primary-action p-3 mt-3"
            onClick={() =>
              void executar(() => c.confirmarRubrica(turmaId, rubricaConferida))
            }
          >
            Confirmar rubrica desta turma
          </button>
          <p className="prisma-meta mt-3">
            Critérios usados em avaliações permanecem protegidos. Alterar a
            rubrica em uso exige versionamento formal.
          </p>
        </details>
      )}
      <details className="prisma-section">
        <summary>Editar datas do cronograma</summary>
        <ul className="space-y-2 mt-3">{c.marcosAcademicos.filter(m=>m.turma_id===turmaId).map(m=><li key={m.marco_id} className="flex flex-wrap items-center gap-2"><span>{m.nome} · {m.data_prazo || 'A definir'} · {m.status}</span><button className="underline p-3" disabled={historico||ocupado} onClick={()=>{setMarcoEditar({...m});setDataMarco(m.data_prazo || '');}}>Editar data de {m.nome}</button></li>)}</ul>
        {marcoEditar&&<form className="space-y-3 mt-3" onSubmit={e=>{e.preventDefault();void executar(async()=>{await c.editarMarco(marcoEditar,dataMarco);setMarcoEditar(null);setMensagem('Data confirmada no servidor.');});}}>
          <p>{marcoEditar.nome}: {marcoEditar.data_prazo || 'A definir'} → {dataMarco || 'Selecione a nova data'}</p>
          <label className="block">Nova data<input className="block border p-3" type="date" required value={dataMarco} disabled={ocupado||historico} onChange={e=>setDataMarco(e.target.value)}/></label>
          <p className="prisma-meta">A confirmação altera somente a data deste marco. Uma versão mais recente no servidor bloqueará a alteração.</p>
          <button className="cs-primary-action p-3" disabled={ocupado||historico}>Confirmar alteração de data</button>
          <button type="button" className="underline p-3" disabled={ocupado} onClick={()=>setMarcoEditar(null)}>Cancelar edição</button>
        </form>}
      </details>
      <details className="prisma-section">
        <summary>Importar cronograma</summary>
        <p className="prisma-meta">
          CSV: nome;data;tipo;codigo_marco;status;origem;visibilidade. Datas ISO
          (AAAA-MM-DD). Aceita INICIO_AULAS, FERIADO, REPOSICAO, SEMINARIO e
          outras categorias administrativas, preservadas em codigo_marco. Nenhum marco existente
          é substituído.
        </p>
        <label className="block text-sm mt-3">
          Conteúdo do cronograma
          <textarea
            disabled={historico || ocupado}
            rows={5}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setMarcos([]);
            }}
            className="block border border-slate-200 p-3 w-full mt-1"
          />
        </label>
        <button
          disabled={historico || ocupado}
          className="underline p-3"
          onClick={() =>
            void executar(() =>
              setMarcos(prepararCronograma(csv, turma, c.marcosAcademicos)),
            )
          }
        >
          Conferir prévia
        </button>
        {marcos.length > 0 && (
          <>
            <ul className="list-disc pl-5 text-sm">
              {marcos.map((m) => (
                <li key={m.marco_id}>
                  {m.nome} · {m.data_prazo} · {m.status} · {m.escopo_marco}
                </li>
              ))}
            </ul>
            <button
              className="cs-primary-action p-3 mt-3"
              disabled={ocupado || historico}
              onClick={() =>
                void executar(async () => {
                  await c.importarCronograma(marcos);
                  setMarcos([]);
                  setCsv("");
                  setMensagem(
                    "Importação registrada. Confira o indicador de sincronização para saber se foi confirmada no servidor.",
                  );
                })
              }
            >
              Confirmar importação
            </button>
          </>
        )}
      </details>
      <details className="prisma-section">
        <summary>
          Inscrições e matrículas pendentes ({pendentes.length})
        </summary>
        <p className="prisma-meta">
          Importe as respostas conferidas do Google Forms em CSV:
          nome;email;identificador_academico. Cada inscrição entra como
          PENDENTE. Aprovação é uma ação separada da professora. Não inclua CPF
          nem dados clínicos.
        </p>
        <label className="block text-sm mt-3">
          Respostas de inscrição
          <textarea
            disabled={historico || ocupado}
            rows={4}
            value={textoInscricoes}
            onChange={(e) => {
              setTextoInscricoes(e.target.value);
              setInscricoes([]);
              setConferido(false);
            }}
            className="block border border-slate-200 p-3 w-full mt-1"
          />
        </label>
        <button
          disabled={historico || ocupado}
          className="underline p-3"
          onClick={() =>
            void executar(() => {
              const rows = lerCsv(textoInscricoes);
              if (
                !rows.length ||
                rows.some(
                  (r) => !r.nome || !r.email || !r.identificador_academico,
                )
              )
                throw new Error(
                  "Informe nome, e-mail e identificador em todas as linhas.",
                );
              setInscricoes(
                rows.map((r) => ({
                  nome: r.nome,
                  email: r.email,
                  identificador_academico: r.identificador_academico,
                })),
              );
            })
          }
        >
          Conferir inscrições
        </button>
        {inscricoes.length > 0 && (
          <>
            <ul className="text-sm space-y-2">
              {inscricoes.map((r, i) => {
                const existente = c.alunos.find(
                  (a) =>
                    a.identificador_academico.trim().toLowerCase() ===
                    r.identificador_academico.trim().toLowerCase(),
                );
                return (
                  <li
                    key={i}
                    className="border border-slate-200 rounded-lg p-3 break-words"
                  >
                    {r.nome} · {r.identificador_academico}
                    {existente && (
                      <p className="prisma-meta">
                        Será vinculado ao cadastro existente: {existente.nome}.
                        Matrículas repetidas não serão recriadas.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <label className="flex gap-2 text-sm mt-3">
              <input
                type="checkbox"
                checked={conferido}
                onChange={(e) => setConferido(e.target.checked)}
              />
              <span>
                Conferi os identificadores e os vínculos com alunos existentes.
              </span>
            </label>
            <button
              disabled={!conferido || ocupado || historico}
              className="cs-primary-action p-3 mt-3"
              onClick={() =>
                void executar(async () => {
                  const r = await c.importarAlunosLote(
                    turmaId,
                    inscricoes,
                    "PENDENTE",
                  );
                  setInscricoes([]);
                  setTextoInscricoes("");
                  setMensagem(
                    `${r.adicionados} inscrições registradas como pendentes; ${r.duplicados} matrículas repetidas ignoradas. Confira a sincronização.`,
                  );
                })
              }
            >
              Receber como pendentes
            </button>
          </>
        )}
        <ul className="space-y-3 mt-4">
          {pendentes.map((m) => {
            const a = c.alunos.find((a) => a.aluno_id === m.aluno_id);
            return (
              <li key={m.matricula_id} className="cs-panel p-3">
                <p className="text-sm">
                  {a?.nome} · {a?.identificador_academico}
                </p>
                <p className="prisma-meta">PENDENTE · {a?.email}</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={historico || ocupado}
                    className="underline p-2"
                    onClick={() =>
                      void executar(() =>
                        c.decidirInscricao(m.matricula_id, true),
                      )
                    }
                  >
                    Aprovar matrícula
                  </button>
                  <button
                    disabled={historico || ocupado}
                    className="underline p-2"
                    onClick={() =>
                      void executar(() =>
                        c.decidirInscricao(m.matricula_id, false),
                      )
                    }
                  >
                    Rejeitar inscrição
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </details>
      {c.isTurmaClinicaAmpliada(turmaId) && (
        <details className="prisma-section">
          <summary>Grupos e composição datada</summary>
          <p className="prisma-meta">
            Vínculos por matrícula. Documentos coletivos são associados uma
            única vez ao grupo.
          </p>
          <label className="block text-sm mt-3">
            Grupo existente ou novo
            <select
              className="block border border-slate-200 p-3 w-full mt-1"
              value={grupoExistente}
              onChange={(e) => {
                setGrupoExistente(e.target.value);
                const g = c.gruposPratica.find(
                  (g) => g.grupo_id === e.target.value,
                );
                setNomeGrupo(String(g?.nome_grupo || g?.nome || ""));
              }}
            >
              <option value="">Criar grupo</option>
              {c.gruposPratica
                .filter((g) => g.turma_id === turmaId)
                .map((g) => (
                  <option key={g.grupo_id} value={g.grupo_id}>
                    {g.nome_grupo || g.nome || "Grupo"}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm mt-3">
            Nome do grupo
            <input
              value={nomeGrupo}
              disabled={!!grupoExistente || ocupado || historico}
              onChange={(e) => setNomeGrupo(e.target.value)}
              className="block border border-slate-200 p-3 w-full mt-1"
            />
          </label>
          <label className="block text-sm mt-3">
            Início do vínculo
            <input
              type="date"
              value={dataGrupo}
              disabled={ocupado || historico}
              onChange={(e) => setDataGrupo(e.target.value)}
              className="block border border-slate-200 p-3 w-full mt-1"
            />
          </label>
          <fieldset disabled={ocupado || historico} className="mt-3 space-y-2">
            <legend className="text-sm font-semibold">
              Matrículas desta turma
            </legend>
            {c.getAlunosDaTurma(turmaId).map((p) => (
              <label
                className="flex gap-2 p-2 text-sm"
                key={p.matricula.matricula_id}
              >
                <input
                  type="checkbox"
                  checked={integrantes.includes(p.matricula.matricula_id)}
                  onChange={(e) =>
                    setIntegrantes((prev) =>
                      e.target.checked
                        ? [...prev, p.matricula.matricula_id]
                        : prev.filter((id) => id !== p.matricula.matricula_id),
                    )
                  }
                />
                {p.aluno.nome}
              </label>
            ))}
          </fieldset>
          <button
            disabled={
              ocupado ||
              historico ||
              !integrantes.length ||
              !nomeGrupo ||
              !dataGrupo
            }
            className="cs-primary-action p-3 mt-3"
            onClick={() =>
              void executar(async () => {
                await c.vincularGrupo(
                  turmaId,
                  nomeGrupo,
                  integrantes,
                  dataGrupo,
                  grupoExistente || undefined,
                );
                setIntegrantes([]);
                setMensagem(
                  "Grupo e vínculos registrados. Confira a sincronização.",
                );
              })
            }
          >
            Confirmar grupo e integrantes
          </button>
        </details>
      )}
      <details className="prisma-section">
        <summary>QR Code de inscrição</summary>
        <p className="prisma-meta">
          Use um Google Forms institucional configurado para inscrição
          acadêmica. Abrir ou fechar o recebimento de respostas é feito no
          próprio Forms. O QR Code não concede acesso ao aplicativo e não cria
          matrícula ativa.
        </p>
        <label className="block text-sm mt-3">
          Link público do Google Forms
          <input
            type="url"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setQr("");
            }}
            className="block border border-slate-200 p-3 w-full mt-1"
          />
        </label>
        <button
          disabled={ocupado}
          className="underline p-3"
          onClick={() =>
            void executar(async () => {
              const u = new URL(link);
              if (
                u.protocol !== "https:" ||
                u.hostname !== "docs.google.com" ||
                !/^\/forms\/d\/(e\/)?[^/]+\/viewform\/?$/.test(u.pathname) ||
                u.username ||
                u.password
              )
                throw new Error(
                  "Informe o link HTTPS de respostas do Google Forms (viewform).",
                );
              setQr(
                await QRCode.toDataURL(u.href, {
                  width: 400,
                  margin: 4,
                  errorCorrectionLevel: "M",
                }),
              );
            })
          }
        >
          Gerar QR Code
        </button>
        {qr && (
          <figure className="mt-3">
            <img
              src={qr}
              alt={`QR Code para inscrição em ${turma.nome}`}
              width={400}
              height={400}
              className="w-full max-w-sm"
            />
            <figcaption className="text-sm break-all">
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Abrir inscrição no Google Forms
              </a>{" "}
              ·{" "}
              <a download="inscricao-qr.png" href={qr} className="underline">
                Baixar QR Code
              </a>
            </figcaption>
          </figure>
        )}
      </details>
    </section>
  );
}
