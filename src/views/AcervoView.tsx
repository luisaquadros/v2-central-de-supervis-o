import React from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { useSupervisao } from "../context/SupervisaoContext";

// Somente referências didáticas existentes; documentos clínicos nunca entram no acervo.
export function AcervoView({
  onOpenTurma,
}: {
  onOpenTurma: (id: string) => void;
}) {
  const { leiturasResponsaveis, turmas, selectedPeriodoId } = useSupervisao();
  const [busca, setBusca] = React.useState("");
  const [turmaId, setTurmaId] = React.useState("");
  const turmasPeriodo = turmas.filter(
    (t) => t.periodo_id === selectedPeriodoId,
  );
  const leituras = leiturasResponsaveis.filter(
    (l) =>
      turmasPeriodo.some((t) => t.turma_id === l.turma_id) &&
      (!turmaId || l.turma_id === turmaId) &&
      `${l.tema || ""} ${l.artigo_leitura || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(busca.toLocaleLowerCase("pt-BR")),
  );
  const referencias = [
    ...new Map(
      leituras.map((l) => [
        `${l.turma_id}|${l.artigo_leitura}|${l.referencia_link}|${l.tema}`,
        l,
      ]),
    ).values(),
  ];
  return (
    <div className="prisma-shell-content space-y-6">
      <header>
        <p className="prisma-meta">Leituras e materiais de apoio</p>
        <h1 className="prisma-title text-3xl">Acervo</h1>
      </header>
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="flex-1 text-sm">
          Buscar material
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="block w-full mt-1 border border-slate-200 bg-white p-3"
            placeholder="Tema ou título"
          />
        </label>
        <label className="text-sm">
          Turma
          <select
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            className="block w-full mt-1 border border-slate-200 bg-white p-3"
          >
            <option value="">Todas neste período</option>
            {turmasPeriodo.map((t) => (
              <option key={t.turma_id} value={t.turma_id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!referencias.length && (
        <p className="prisma-empty">
          Nenhuma referência encontrada para estes filtros.
        </p>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {referencias.map((l, i) => {
          let link: string | undefined;
          try {
            const u = new URL(l.referencia_link || "");
            if (["https:", "http:"].includes(u.protocol)) link = u.href;
          } catch {}
          const turma = turmas.find((t) => t.turma_id === l.turma_id);
          return (
            <li key={i} className="cs-panel p-5 space-y-3">
              <BookOpen aria-hidden className="w-5 h-5 cs-brand-accent" />
              <h2 className="font-semibold">
                {l.artigo_leitura || l.tema || "Leitura sem título"}
              </h2>
              <p className="prisma-meta">{l.tema}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cs-reading-link underline inline-flex items-center gap-1"
                  >
                    Abrir referência
                    <ExternalLink aria-hidden className="w-4 h-4" />
                  </a>
                ) : (
                  <span className="prisma-meta">Referência sem link</span>
                )}
                {turma && (
                  <button
                    className="underline"
                    onClick={() => onOpenTurma(turma.turma_id)}
                  >
                    {turma.nome}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
