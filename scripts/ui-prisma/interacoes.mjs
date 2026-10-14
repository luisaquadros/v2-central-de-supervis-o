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
for (const scenario of ["navegacao", "chamada", "monitora", "lista-longa"]) {
  const view =
    scenario === "chamada"
      ? "aula"
      : scenario === "monitora"
        ? "monitora"
        : "shell";
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const criticalPayloads = [];
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
          ["av-test", "m-test", "c-test", 5, ""],
        ],
      };
      const body = u.pathname.endsWith("values:batchGet")
        ? {
            valueRanges: u.searchParams
              .getAll("ranges")
              .map((range) => ({
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
    "http://127.0.0.1:4174/__prisma_ui_fixture.html?view=" +
      view +
      (scenario === "lista-longa" ? "&count=60" : ""),
  );
  await page.waitForFunction(() => window.auditContext?.turmas.length === 1);
  await page.waitForTimeout(400);
  const result = { scenario, errors };
  if (scenario === "navegacao") {
    const bottom = page.getByRole("navigation", { name: "Navegação rápida" });
    for (const label of ["Agenda", "Turmas", "Avaliações", "Hoje"]) {
      await bottom.getByRole("button", { name: label, exact: true }).click();
      await page.waitForFunction(
        () =>
          !document
            .querySelector("main")
            ?.textContent?.includes("Carregando área…"),
      );
      await page.waitForTimeout(150);
      result[label] = await page.getByRole("main").innerText();
    }
    await bottom.getByRole("button", { name: "Mais", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Menu PRISMA" });
    await dialog.waitFor();
    result.menuFocus = await page.evaluate(
      () => document.activeElement?.textContent,
    );
    await page.keyboard.press("Shift+Tab");
    result.focusTrapped = await page.evaluate(
      () => !!document.activeElement?.closest("[role=dialog]"),
    );
    await page.keyboard.press("Escape");
    result.menuClosed = (await dialog.count()) === 0;
    await bottom.getByRole("button", { name: "Mais", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("button", { name: "Acervo", exact: true })
      .click();
    await page.getByRole("heading", { name: "Acervo", exact: true }).waitFor();
    await page
      .getByRole("searchbox", { name: "Buscar material" })
      .fill("sem resultado");
    result.emptySearch = await page
      .getByText("Nenhuma referência encontrada para estes filtros.")
      .isVisible();
  }
  if (scenario === "chamada") {
    const close = page.getByRole("button", {
      name: "Encerrar chamada",
      exact: true,
    });
    await close.click();
    await page.getByRole("dialog").waitFor();
    result.writesBeforeConfirmation = criticalPayloads.length;
    result.focusPreview = await page.evaluate(() =>
      document.activeElement?.textContent?.trim(),
    );
    await page.keyboard.press("Escape");
    result.cancelled =
      (await page.getByRole("dialog").count()) === 0 &&
      criticalPayloads.length === 0;
    await page.evaluate(async () => {
      const sheets = await import("/src/services/googleSheetsService.ts");
      sheets.setMockToken("sintetico");
    });
    await close.click();
    await page
      .getByRole("button", { name: "Confirmar e encerrar chamada" })
      .click();
    await page.waitForTimeout(700);
    result.writesAfterConfirmation = criticalPayloads.map((p) => ({
      table: p.tabela,
      type: p.tipo,
      status: p.registro?.status,
    }));
    await page
      .getByRole("button", { name: "Diário e retomadas", exact: true })
      .last()
      .click();
    result.diaryVisible = await page
      .getByRole("heading", { name: "Diário, discussão e retomadas" })
      .isVisible();
  }
  if (scenario === "monitora") {
    const bottom = page.getByRole("navigation", { name: "Navegação rápida" });
    result.gradeDestinationAbsent =
      (await bottom
        .getByRole("button", { name: "Avaliações", exact: true })
        .count()) === 0;
    await bottom.getByRole("button", { name: "Turmas", exact: true }).click();
    await page
      .getByRole("button", { name: "Modo Supervisão", exact: true })
      .waitFor();
    result.attendanceDisabled = await page
      .getByRole("button", { name: "Modo Supervisão", exact: true })
      .isDisabled();
  }
  if (scenario === "lista-longa") {
    await page
      .getByRole("navigation", { name: "Navegação rápida" })
      .getByRole("button", { name: "Turmas", exact: true })
      .click();
    await page.getByRole("button", { name: "Abrir", exact: true }).click();
    await page.getByRole("button", { name: "Pessoas", exact: true }).click();
    result.studentCount = await page.getByText(/Estudante fictício/).count();
    result.widths = [];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      result.widths.push(
        await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        })),
      );
    }
  }
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  result.violations = axe.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes
      .map((n) => ({ target: n.target, summary: n.failureSummary }))
      .slice(0, 8),
  }));
  findings.push(result);
  console.log(JSON.stringify(result));
  await context.close();
}
await browser.close();
fs.writeFileSync(
  out + "/interacoes.json",
  JSON.stringify(findings, null, 2) + "\n",
);

for (const f of findings) {
  assert.deepEqual(f.errors, [], `${f.scenario}: erros de execução`);
  assert.deepEqual(f.violations, [], `${f.scenario}: acessibilidade`);
  if (f.scenario === "navegacao") {
    assert.equal(f.focusTrapped, true);
    assert.equal(f.menuClosed, true);
    assert.equal(f.emptySearch, true);
    for (const label of ["Agenda", "Turmas", "Avaliações", "Hoje"])
      assert.ok(f[label].includes(label));
  }
  if (f.scenario === "chamada") {
    assert.equal(f.writesBeforeConfirmation, 0);
    assert.equal(f.cancelled, true);
    assert.equal(f.focusPreview, "Voltar e ajustar");
    assert.equal(f.writesAfterConfirmation.length, 2);
    assert.equal(f.writesAfterConfirmation[0].status, "PRESENTE");
    assert.equal(f.diaryVisible, true);
  }
  if (f.scenario === "monitora") {
    assert.equal(f.gradeDestinationAbsent, true);
    assert.equal(f.attendanceDisabled, true);
  }
  if (f.scenario === "lista-longa") {
    assert.equal(f.studentCount, 59);
    for (const w of f.widths) assert.equal(w.width, w.scrollWidth);
  }
}
console.log("PRISMA: interações, chamada e listas longas aprovadas.");
