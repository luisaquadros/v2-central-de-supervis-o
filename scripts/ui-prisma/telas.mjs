import { strict as assert } from "node:assert";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const out = process.env.PRISMA_ARTIFACT_DIR || "artifacts/ui-prisma";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const findings = [];
for (const view of [
  "login",
  "shell",
  "monitora",
  "turma",
  "ficha",
  "acervo",
  "aula",
  "avaliacao",
  "modal",
]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const criticalPayloads = [];
  let remoteGrade = 5;
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/acesso")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          papel: "PROFESSORA_ADMIN",
          email: "professora@exemplo.com",
          turmas: ["*"],
          operacoes: ["CHAMADA", "ENTREGAS", "DOCUMENTOS_VER"],
        }),
      });
    if (u.pathname === "/api/critical-write") {
      const p = route.request().postDataJSON();
      criticalPayloads.push(p);
      if (p.tabela === "avaliacoes" && p.tipo === "UPDATE") {
        if (Number(p.esperado?.nota) !== remoteGrade)
          return route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              ok: false,
              code: "CONFLITO_VERSAO",
              message: "Versão mais recente encontrada.",
              campos: ["nota"],
            }),
          });
        remoteGrade = Number(p.registro.nota);
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    if (u.hostname === "sheets.googleapis.com") {
      const data = {
        periodos: [
          ["periodo_id", "nome", "data_inicio", "data_fim", "status"],
          ["p-test", "Período sintético", "2026-08-01", "2026-12-20", "ATIVO"],
        ],
        disciplinas: [
          ["disciplina_id", "nome", "tipo"],
          ["d-test", "Disciplina sintética", "INDIVIDUAL"],
        ],
        turmas: [
          [
            "turma_id",
            "periodo_id",
            "disciplina_id",
            "nome",
            "turno",
            "status",
          ],
          ["t-test", "p-test", "d-test", "Turma sintética", "NOTURNO", "ATIVO"],
        ],
        alunos: [
          ["aluno_id", "nome", "identificador_academico", "status"],
          ["a-test", "Estudante sintético", "RA-SINTETICO", "ATIVO"],
        ],
        matriculas: [
          ["matricula_id", "aluno_id", "turma_id", "periodo_id", "status"],
          ["m-test", "a-test", "t-test", "p-test", "MATRICULADO"],
        ],
        criterios_avaliacao: [
          [
            "criterio_id",
            "turma_id",
            "disciplina_id",
            "periodo_id",
            "nome",
            "nota_maxima",
            "peso",
            "ativo",
          ],
          [
            "c-test",
            "t-test",
            "d-test",
            "p-test",
            "Critério sintético",
            10,
            1,
            true,
          ],
        ],
        avaliacoes: [
          ["avaliacao_id", "matricula_id", "criterio_id", "nota", "observacao"],
          ["av-test", "m-test", "c-test", remoteGrade, ""],
        ],
      };
      const body = u.pathname.endsWith("values:batchGet")
        ? {
            valueRanges: u.searchParams.getAll("ranges").map((range) => ({
              range,
              values: data[range.split("!")[0].replaceAll("'", "")] || [],
            })),
          }
        : {
            sheets: Object.keys(data).map((title) => ({
              properties: { title },
            })),
          };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    if (["localhost", "127.0.0.1"].includes(u.hostname))
      return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    view === "login"
      ? "http://127.0.0.1:4174/"
      : "http://127.0.0.1:4174/__prisma_ui_fixture.html?view=" + view,
  );
  if (view === "login")
    await page
      .getByRole("button", {
        name: "Conectar Google Workspace & Carregar Base",
      })
      .waitFor();
  else
    await page.waitForFunction(() => window.auditContext?.turmas?.length === 1);
  await page.waitForTimeout(500);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const horizontalOverflow = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  await page.screenshot({
    path: out + "/" + view + "-mobile.png",
    fullPage: true,
  });
  const result = {
    view,
    errors,
    horizontalOverflow,
    violations: axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes
        .map((n) => ({ target: n.target, summary: n.failureSummary }))
        .slice(0, 8),
    })),
  };
  if (view === "modal") {
    await page.evaluate(() => {
      window.auditContext.addOrientacao = () =>
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Falha sintética de persistência")),
            100,
          ),
        );
    });
    await page.locator("textarea").fill("Observação sintética");
    await page.getByRole("button", { name: "Salvar Orientação" }).click();
    await page.waitForTimeout(200);
    result.closedBeforeSave = await page.evaluate(
      () => window.auditClosed === true,
    );
  }
  if (view === "avaliacao") {
    await page.locator("input[type=number]").first().fill("7");
    result.beforeUnrelatedRender = await page
      .locator("input[type=number]")
      .first()
      .inputValue();
    remoteGrade = 8;
    await page.evaluate(async () => {
      const sheets = await import("/src/services/googleSheetsService.ts");
      sheets.setMockToken("sintetico");
      await window.auditContext.sincronizarAgora();
    });
    await page.waitForTimeout(200);
    result.afterUnrelatedRender = await page
      .locator("input[type=number]")
      .first()
      .inputValue();
  }
  if (view === "avaliacao") {
    await page
      .getByRole("button", { name: "Salvar Rascunho", exact: true })
      .click();
    await page.waitForTimeout(300);
    result.originalGradeBase = criticalPayloads.find(
      (p) => p.tabela === "avaliacoes",
    )?.esperado?.nota;
    result.remoteGradePreserved = remoteGrade;
    result.conflictVisible =
      (await page
        .getByText(/CONFLITO_VERSAO|[Cc]onflito de versão|mais recente/)
        .count()) > 0;
  }

  if (view === "aula") {
    result.emptyDocumentStatus =
      (await page.getByText("Não verificado", { exact: true }).count()) > 0;
    result.noFalseDocumentSuccess =
      (await page.getByText("Tudo entregue", { exact: true }).count()) === 0;
    result.noFalseRssSuccess =
      (await page
        .getByText("Calendário não verificado", { exact: true })
        .count()) > 0;

    result.chamada = await page.evaluate(async () => {
      const sheets = await import("/src/services/googleSheetsService.ts");
      sheets.setMockToken("sintetico");
      return window.auditContext.salvarChamadaPorExcecao(
        "t-test",
        "2026-10-13",
        [],
      );
    });
    result.criticalPayloadTypes = criticalPayloads.map((p) => ({
      tabela: p.tabela,
      tipo: p.tipo,
    }));
    await page.evaluate(async () => {
      const sheets = await import("/src/services/googleSheetsService.ts");
      sheets.clearAccessToken();
      await window.auditContext.reagendarEncontro(
        "t-test",
        "2026-10-14",
        "2026-10-15",
      );
    });
    await page.waitForTimeout(100);
    result.reagendamento = await page.evaluate(async () => {
      const db = await import("/src/services/indexedDbService.ts");
      const cache = await db.carregarTodasTabelasDoIndexedDb();
      return window.auditContext.encontrosTurma
        .filter((e) => e.data !== "2026-10-13")
        .map((e) => ({
          data: e.data,
          idUI: e.encontro_id,
          idCache: cache.encontros_turma.find((r) => r.data === e.data)
            ?.encontro_id,
        }));
    });
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await page.waitForTimeout(400);
  const dark = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  result.darkViolations = dark.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes
      .map((n) => ({ target: n.target, summary: n.failureSummary }))
      .slice(0, 8),
  }));
  console.log("dark-" + view, JSON.stringify(result.darkViolations));
  await page.setViewportSize({ width: 1280, height: 900 });
  result.overflow1280 = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  const desktopAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  result.desktopViolations = desktopAxe.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes
      .map((n) => ({ target: n.target, summary: n.failureSummary }))
      .slice(0, 8),
  }));
  await page.screenshot({
    path: out + "/" + view + "-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  result.overflow320 = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  console.log("width320-" + view, JSON.stringify(result.overflow320));
  findings.push(result);
  console.log(
    view,
    JSON.stringify({
      errors: result.errors,
      overflow: horizontalOverflow,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
      })),
      before: result.beforeUnrelatedRender,
      after: result.afterUnrelatedRender,
      closedBeforeSave: result.closedBeforeSave,
      chamada: result.chamada,
      payloads: result.criticalPayloadTypes,
      reagendamento: result.reagendamento,
    }),
  );
  await context.close();
}
await browser.close();
fs.writeFileSync(
  out + "/browser-resultados.json",
  JSON.stringify(findings, null, 2) + "\n",
);

for (const f of findings) {
  assert.deepEqual(f.errors, [], `${f.view}: erros de execução`);
  assert.deepEqual(f.violations, [], `${f.view}: acessibilidade clara`);
  assert.deepEqual(
    f.desktopViolations,
    [],
    `${f.view}: acessibilidade desktop`,
  );
  assert.deepEqual(f.darkViolations, [], `${f.view}: acessibilidade escura`);
  for (const size of [f.horizontalOverflow, f.overflow320, f.overflow1280])
    assert.equal(size.viewport, size.document, `${f.view}: rolagem horizontal`);
  if (f.view === "aula") {
    assert.equal(f.emptyDocumentStatus, true);
    assert.equal(f.noFalseDocumentSuccess, true);
    assert.equal(f.noFalseRssSuccess, true);
  }
  if (f.view === "avaliacao") {
    assert.equal(f.afterUnrelatedRender, "7");
    assert.equal(Number(f.originalGradeBase), 5);
    assert.equal(f.remoteGradePreserved, 8);
    assert.equal(f.conflictVisible, true);
  }
  if (f.view === "modal") assert.equal(f.closedBeforeSave, false);
}
console.log("PRISMA: nove telas nos temas claro e escuro aprovadas.");
