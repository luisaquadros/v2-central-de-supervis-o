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
for (const scenario of [
  "navegacao",
  "chamada",
  "monitora",
  "lista-longa",
  "gestao",
  "mudanca-escopo",
]) {
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
  let papelServidor = "PROFESSORA_ADMIN";
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/acesso")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          papel: papelServidor,
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
  if(scenario==='navegacao'){
    await page.getByRole('navigation',{name:'Navegação rápida'}).getByRole('button',{name:'Avaliações',exact:true}).click();
    await page.getByText('Estudante sintético',{exact:true}).waitFor();
    await page.evaluate(async()=>{const s=await import('/src/services/googleSheetsService.ts');s.setMockToken('sintetico');const id=await window.auditContext.createNovoPeriodo('2028.1','2028-02-01','2028-06-30');window.auditContext.setSelectedPeriodoId(id);});
    await page.getByText('Nenhuma turma neste período. Cadastre uma turma antes de avaliar.',{exact:true}).waitFor();
    result.periodoVazioIsolado=await page.getByText('Estudante sintético',{exact:true}).count()===0;
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
  if (scenario === "mudanca-escopo") {
    await page.evaluate(async () => {
      const s = await import("/src/services/googleSheetsService.ts");
      s.setMockToken("sintetico");
      await window.auditContext.sincronizarAgora();
    });
    await page.waitForTimeout(200);
    papelServidor = "MONITORA";
    await page.evaluate(async () => {
      window.auditDisableAuthOverride = true;
      const e = await import("/src/services/escritaCoordenadaService.ts");
      await e.obterPerfilServidor(true);
    });
    await page.waitForFunction(() => window.auditContext.acessoGoogleValidado === false);
    result.acessoBloqueado = await page.evaluate(() => !window.auditContext.acessoGoogleValidado);
    result.navegacaoAnteriorAusente = await page.getByRole("navigation", { name: "Navegação rápida" }).count() === 0;
  }
  if (scenario === "gestao") {
    await page.evaluate(async () => {
      const s = await import("/src/services/googleSheetsService.ts");
      s.setMockToken("sintetico");
      await window.auditContext.sincronizarAgora();
    });
    await page.waitForTimeout(200);
    const bottom = page.getByRole("navigation", { name: "Navegação rápida" });
    await bottom.getByRole("button", { name: "Mais", exact: true }).click();
    await page.getByText("Mais e administração", { exact: true }).click();
    await page.getByRole("button", { name: "Semestres", exact: true }).click();
    await page
      .getByRole("button", { name: "Novo semestre", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Identificação", exact: true })
      .fill("2027.1");
    await page
      .getByLabel("Início do semestre", { exact: true })
      .fill("2027-02-01");
    await page
      .getByLabel("Término do semestre", { exact: true })
      .fill("2027-06-30");
    await page
      .getByLabel("Início das aulas (opcional)", { exact: true })
      .fill("2027-02-08");
    await page
      .getByRole("combobox", { name: "Modelo anterior" })
      .selectOption("p-test");
    await page
      .getByRole("button", { name: "Criar semestre planejado" })
      .click();
    await page.getByRole("heading", { name: "2027.1", exact: true }).waitFor();
    result.semestreCriado = await page.evaluate(() =>
      window.auditContext.periodos.some((p) => p.nome === "2027.1"),
    );
    await bottom.getByRole("button", { name: "Turmas", exact: true }).click();
    await page.getByRole("button", { name: "Abrir", exact: true }).click();
    await page.getByRole("button", { name: "Pessoas", exact: true }).click();
    await page
      .getByText("Inscrições e matrículas pendentes (0)", { exact: true })
      .click();
    await page
      .getByLabel("Respostas de inscrição", { exact: true })
      .fill(
        "nome;email;identificador_academico\nPessoa fictícia nova;pessoa@exemplo.invalid;RA-NOVO\nPessoa fictícia nova;pessoa@exemplo.invalid;RA-NOVO",
      );
    await page
      .getByRole("button", { name: "Conferir inscrições", exact: true })
      .click();
    await page
      .getByRole("checkbox", {
        name: "Conferi os identificadores e os vínculos com alunos existentes.",
      })
      .check();
    await page
      .getByRole("button", { name: "Receber como pendentes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Aprovar matrícula", exact: true })
      .waitFor();
    result.inscricaoPendente = await page.evaluate(
      () =>
        window.auditContext.matriculas.filter((m) => m.status === "PENDENTE")
          .length,
    );
    result.pendenteEnviado = criticalPayloads.some(
      (p) => p.tabela === "matriculas" && p.registro.status === "PENDENTE",
    );
    await page
      .getByRole("button", { name: "Aprovar matrícula", exact: true })
      .click();
    await page.waitForFunction(() =>
      window.auditContext.matriculas.some(
        (m) => m.status === "MATRICULADO" && m.aluno_id !== "a-test",
      ),
    );
    result.matriculaAprovada = true;
    await page.getByText("Conferir rubrica herdada", { exact: true }).click();
    await page
      .getByRole("checkbox", {
        name: "Conferi estes critérios e pesos com a rubrica oficial para esta turma.",
      })
      .check();
    await page
      .getByRole("button", {
        name: "Confirmar rubrica desta turma",
        exact: true,
      })
      .click();
    await page.waitForFunction(() =>
      window.auditContext.criterios.some(
        (c) => c.status_validacao === "CONFIRMADO",
      ),
    );
    result.rubricaConferida = true;
    await page.getByText("QR Code de inscrição", { exact: true }).click();
    await page
      .getByLabel("Link público do Google Forms", { exact: true })
      .fill("https://docs.google.com/forms/d/e/formulario-ficticio/viewform");
    await page
      .getByRole("button", { name: "Gerar QR Code", exact: true })
      .click();
    await page.getByRole("img", { name: /QR Code para inscrição/ }).waitFor();
    result.qrExibido = (
      await page
        .getByRole("img", { name: /QR Code para inscrição/ })
        .getAttribute("src")
    ).startsWith("data:image/png");
    await page.getByText("Importar cronograma", { exact: true }).click();
    await page
      .getByLabel("Conteúdo do cronograma", { exact: true })
      .fill(
        "nome;data;tipo;status;visibilidade\nProva fictícia;2027-05-10;PROVA;CONFIRMADO;DOCENTE",
      );
    await page
      .getByRole("button", { name: "Conferir prévia", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar importação", exact: true })
      .click();
    await page.waitForFunction(() =>
      window.auditContext.marcosAcademicos.some(
        (m) => m.nome === "Prova fictícia",
      ),
    );
    result.cronogramaRegistrado = true;
    await page.setViewportSize({ width: 320, height: 800 });
    result.gestaoOverflow = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
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
    assert.equal(f.periodoVazioIsolado,true);
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
  if (f.scenario === "mudanca-escopo") {
    assert.equal(f.acessoBloqueado, true);
    assert.equal(f.navegacaoAnteriorAusente, true);
  }
  if (f.scenario === "gestao") {
    assert.equal(f.semestreCriado, true);
    assert.equal(f.inscricaoPendente, 1);
    assert.equal(f.pendenteEnviado, true);
    assert.equal(f.matriculaAprovada, true);
    assert.equal(f.qrExibido, true);
    assert.equal(f.rubricaConferida, true);
    assert.equal(f.cronogramaRegistrado, true);
    assert.equal(f.gestaoOverflow.width, f.gestaoOverflow.scrollWidth);
  }
  if (f.scenario === "lista-longa") {
    assert.equal(f.studentCount, 59);
    for (const w of f.widths) assert.equal(w.width, w.scrollWidth);
  }
}
console.log("PRISMA: interações, chamada e listas longas aprovadas.");
