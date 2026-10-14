# Central de Supervisão — Documento Mestre

Atualizado em 13/10/2026 · Branch `fix/backend-persistencia-integridade` (PR #46) · Substitui `DIAGNOSTICO_FASE0` e `ENTREGA_E1_E2` (ficam no histórico do git).

**Base normativa:** PRD v1.1, Adendo v1.2 e decisões D1–D7 informadas em 13/10/2026.
**Regra de leitura:** ✅ implementado e testado · 🟡 parcial · ⏸ pronto, aguardando validação/ativação real · ❌ não feito · ❓ depende de decisão.

---

## 1. Antes de publicar (ação obrigatória)

| # | Ação | Onde | Se não fizer |
|---|---|---|---|
| 1 | Definir `ADMIN_EMAILS` (e-mail da professora administradora) | Cloudflare → Worker → Variables | **Nenhuma gravação é aceita** (falha fechada, D4) |
| 2 | Conferir o Apps Script (Gatilhos, Implantações, Execuções), também em *Extensões → Apps Script* da planilha | script.google.com | Este PR remove `gas/`; se algo estiver em uso, não mesclar (reverter `59ea391`) |
| 3 | *(só para monitoras e sincronização)* criar conta de serviço, guardar o JSON em `GOOGLE_SERVICE_ACCOUNT_JSON` (segredo), compartilhar a planilha como **Editora** e as pastas/arquivos monitorados como **Leitora** com o e-mail dela | Google Cloud + Cloudflare | Monitoras e sincronização retornam 503 |
| 4 | *(só para monitoras)* definir `ACESSOS_JSON` (ver §5) | Cloudflare | Não há monitoras |
| 5 | **Ativar a sincronização** apenas depois do teste real (§8) | Variável `SINCRONIZACAO_DOCUMENTOS=ligada` + bloco `triggers` | Sincronização permanece desligada |

---

## 2. Arquitetura efetivamente implementada

```
Navegador (React + Firebase Auth/Google)
 ├─ leitura  → Sheets API direto (administradora)  |  /api/leitura (monitora, filtrada)
 ├─ gravação → fila local (IndexedDB) → /api/critical-write
 └─ painéis  → /api/acesso · /api/documentos/estado · /api/documentos/sincronizar
Cloudflare Worker (src/server/worker.ts — só exporta handler e Durable Object)
 ├─ autenticarPerfil: token de ID do Firebase verificado (RS256) + perfil de ADMIN_EMAILS/ACESSOS_JSON
 ├─ WriteCoordinator (Durable Object): serializa, compara versão (CAS), idempotência por operacaoId,
 │    autoriza tabela/turma, grava, escreve log_alteracoes, sincroniza metadados do Drive
 └─ scheduled(): dispara a sincronização só nos crons 0 11 * * * e 0 21 * * * e só se ligada
Google Sheets (planilha 1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4) · Drive API (somente metadados)
```

| Componente | Arquivo | Papel |
|---|---|---|
| Autorização | `autorizacao.ts`, `acessos.ts` | identidade e perfil no servidor |
| Conta de serviço | `contaServico.ts` | JWT-bearer; usada por monitoras, leitura filtrada e sincronização |
| Escrita crítica | `coordenacaoCritica.ts`, `worker.ts` | versão, log, tabelas coordenadas |
| Sincronização Drive | `sincronizacaoDocumentos.ts` | metadados → `monitoramento_documentos` |
| Cliente | `escritaCoordenadaService.ts`, `leituraServidor.ts`, `syncService.ts` | fila, perfil, leitura via servidor |

**Planilha em uso (D5).** O Worker e o app usam **uma só** planilha, fixada no código: *Central de Supervisão — DESENVOLVIMENTO* (`1DwhmAS…`). No Drive existem também: *Central de Controle dos Estágios 2026.2* e sua versão *HOMOLOGAÇÃO* (fontes de importação, somente leitura), *Base de Integração* e *[2.2026] Registro Semanal (respostas)* (origem do RSS). **Não existe outra planilha "de produção" da Central.** ❓ Decisão pendente: manter esta como canônica ou criar cópia oficial. Nenhuma migração de base foi feita.

**Remoções.** `gas/`, `gasService.ts` e as ramificações `isRunningInAppsScript` (só rodavam dentro do Apps Script) foram removidos; o caminho do navegador é o único.

---

## 3. Modelo de dados e origem de cada informação

| Informação | Aba | Quem escreve | Quem lê | Observação |
|---|---|---|---|---|
| Estudante / matrícula / turma / horário | `alunos`, `matriculas`, `turmas`, `horarios_turma` | app (coordenador, com versão) | todos (monitora filtrada) | ID estável; vínculo nunca por nome |
| Condição na turma | `matriculas.papel_na_turma` | professora | app | Ex.: `REPRESENTANTE`, `SUPERVISAO_HORARIO_ALTERNATIVO` (valores combináveis por `; , \|`). **Sem cadastro paralelo** |
| Encontro / frequência | `encontros_turma`, `frequencias` | app (coordenador) | todos | chamada por exceção (ver §4) |
| Entregas de documentos | `entregas` | app (coordenador) | todos | status simples entregue/não; independente do Drive |
| **Metadados de documentos do Drive** | `monitoramento_documentos` | **somente o Worker** (4 colunas) + cadastro manual das linhas | app | `titular_tipo` MATRICULA ou GRUPO + `titular_id` (IDs estáveis) |
| Resultado da sincronização | `sincronizacao` (linhas `DRIVE_METADADOS`) + histórico no Durable Object | Worker | painel | |
| Trilha de auditoria | `log_alteracoes` (criada na 1ª gravação) | Worker | administradora | identidade verificada; **sem texto livre** |
| RSS (entregas) | `registros_semanais` (fórmula, somente leitura) | formulário/planilha | app | fonte da entrega; **nunca alterada pelo app** |
| RSS: correção de associação e observação pontual | `rss_ajustes` (aditiva) | administradora (coordenador, com versão e log) | administradora; monitora sem observação/autoria | §4.6 |
| Avaliações oficiais | `avaliacoes`, `avaliacoes_completas`, `criterios_avaliacao` | app (coordenador) | só administradora | **fonte oficial de critérios e notas** (§4.1) |
| Rubricas, configuração, rascunhos, evidências | `config_avaliacao`, `rubricas_avaliacao`, `avaliacao_rascunhos`, `evidencias_avaliacao` | app (coordenador); monitora só `evidencias_avaliacao` (preliminar, própria) | administradora; monitora: rubrica + as próprias contribuições | aditivas e versionadas (§4.4); abas ainda **não criadas** na planilha |
| Ainda no caminho direto (4) | `configuracoes`, `marcos_academicos`, `criterios_avaliacao`, `registros_semanais` | navegador da administradora | todos | `registros_semanais` e `marcos_academicos` parecem derivados por fórmula/origem (escrever pode sobrescrever fórmulas); `criterios_avaliacao` aguarda D3; `configuracoes` mistura itens operacionais. Migrar só após conferir |

Colunas escritas pela sincronização: `data_modificacao_drive`, `consultado_em`, `status`, `erro_codigo`. **Nunca** `validacao_manual`, observações, `origem_metadado` ou qualquer outra. Não cria nem remove linhas.

---

## 4. Regras de negócio

**Confirmadas e implementadas**
- Chamada por exceção: o app não presume presença antes de a professora salvar; **matrícula com `SUPERVISAO_HORARIO_ALTERNATIVO` não recebe presença nem falta automática** nos encontros coletivos (só há registro se ela marcar explicitamente).
- Recente (documento) = modificado nos últimos **7 dias** (configurável pela chave `janela_documentos_dias` em `configuracoes`; independente da janela do RSS). **Modificação não indica entrega, versão correta nem qualidade.**
- Falta de permissão (`SEM_PERMISSAO`) é distinta de arquivo ausente (`NAO_ENCONTRADO_NA_PASTA`).
- Clínica Ampliada: **um documento por grupo**, exibido uma vez na turma e como "coletivo" na ficha dos integrantes. Consultoria Organizacional: documentos **individuais** por matrícula.
- Notas oficiais não são calculadas nem alteradas por esta entrega; nenhum registro histórico é excluído automaticamente.
- Restauração de backup é sempre por registro, com confirmação, e nunca apaga o que foi criado depois.

**Decididas**
- D1 ✅ implementada: chamada aberta = `NAO_REGISTRADO`; ao encerrar, prévia de quem será considerado presente e confirmação explícita. Pendente: reabrir/retificar chamada encerrada com justificativa, data e autor.
- D2: faltas, atrasos, justificativas e dispensas registrados separadamente, sem presumir abono ou reposição (E3).
- D3: critérios, pesos e competências configuráveis por turma; rubrica versionada; prazo de homologação 14 dias corridos após o início das aulas; sem notas oficiais com critérios não confirmados (E5).

**Pendentes de decisão institucional ❓:** regulamento de faltas/atrasos/reposição (D2), pesos oficiais (D3), planilha canônica (D5), política de edição offline além de "fila ≠ salvo" (D6), retenção e exportação (D7), monitoras e coordenação além do descrito.

---

### 4.1 Avaliação: estrutura real encontrada (auditoria na cópia anonimizada da planilha de desenvolvimento)

- **6 turmas × 8 critérios = 10,0** em todas: Prova 2,0 · Parte 1 do relatório 1,0 · Relatório final 2,0 · Documentação 2,5 · Seminário/Atividade avaliativa 0,5 · Participação nas supervisões 0,8 · Desempenho técnico e profissional 1,0 · Assiduidade e pontualidade 0,2. Pesos iguais; **nomes variam por turma**; `codigo_criterio` é estável (ex.: `DOCUMENTACAO_CLINICA` × `DOCUMENTACAO_PRATICA`). `peso` = 1 em todas as linhas (não é peso de cálculo).
- `avaliacoes`: uma nota **em pontos** por matrícula×critério, com `valor_original` (nota bruta da fonte, ex. prova "5,0" → 1,0), `origem`, `status_revisao`. `avaliacoes_completas`: comentários e pontos por critério (JSON).
- **Não existem subcritérios, descritores nem rubricas internas implementados.** A rubrica de Documentação é nova e aditiva.
- ⚠️ **Divergência ficha × planilha (decisão sua):** a ficha de feedback parcial lista "Registros semanais 0,5" onde a planilha tem "Seminário/Atividade avaliativa 0,5". Nenhum critério de registros semanais foi criado; a associação acadêmica está **pendente**.
- ⚠️ **Valores "provisórios" da ficha** (Documentação 1,25, Participação 0,40, Desempenho 0,50, Assiduidade 0,10 = 50% do peso): o app **não** os trata como nota; só a nota lançada em `avaliacoes` é oficial.
- **Cálculo duplicado corrigido:** `AvaliacaoView` e `AlunoFichaView` somavam por conta própria (filtros de critério diferentes; nota inválida virava 0). Agora usam `avaliacaoResumo.ts`. Soma idêntica à legada em dados válidos (teste); nota inválida passa a ser **sinalizada e excluída**, nunca zero silencioso. `FeedbackModal` também não mostra 0,0 para nota ausente/inválida.

### 4.2 Engine de cálculo (`avaliacaoEngine.ts`, `avaliacaoAdaptador.ts`, `avaliacaoResumo.ts`)

- **Quatro coisas separadas:** **oficial** (nota lançada; a engine nunca a altera) · **prévia** (proporção/rubrica; diagnóstico, nunca gravada sozinha) · **prazo** (cumprimento de entrega; não gera nota nem desconto sem regra expressa) · **divergência** (oficial × prévia, só sinalizada).
- **Sem configuração, todo critério é `manual`.** Nenhuma fórmula é inferida pelo nome. Classificação inicial **sugerida** (D3) por `codigo_criterio`: prova=proportional; relatórios/seminário=rubric; documentação/desempenho/assiduidade=hybrid; participação=continuous.
- Prova proporcional: bruto ÷ 10 × valor (`valor_original`); RSS **não** é critério. Participação/desempenho **não** vêm do tempo decorrido (`progressRatio` removido). Rubrica/híbrido só calculam prévia com fórmula declarada e versão **aprovada**.
- Invariantes: ausente = `null`; inválido/fora do limite → `a_conferir`, fora da soma; sem média parcial, nota convertida para 10 ou projeção; ocorrência sem regra cadastrada nunca desconta (ética relevante gera sinalização separada); o mesmo fato não penaliza dois critérios.

### 4.3 Rubrica de Documentação, níveis e rascunhos (`rubricasAvaliacao.ts`)

- 6 subcritérios (0,65 · 0,50 · 0,45 · 0,40 · 0,30 · 0,20 = 2,5), com foco e **descritores específicos por nível** e por tipo de estágio (Clínica Adulto, Clínica Ampliada; Consultoria Organizacional preparada, sem descritores clínicos e em rascunho).
- Níveis: Excelente 100% · Adequado 75% · Parcial 50% · Insuficiente 25% · Não atendido 0% · **Não avaliado = null**. Ajuste manual exige justificativa e entra no histórico.
- Versões imutáveis: editar pesos cria nova versão (rascunho até aprovar); rascunhos guardam a versão e os pesos usados. Documento **coletivo** só gera sugestão; a professora adota item a item na avaliação individual.
- A nota só vira oficial por **confirmação explícita** (diálogo com valor proposto × oficial atual e diferença), pelo caminho de gravação existente (`saveAvaliacao`: fila, coordenador, log).

### 4.4 Estrutura aditiva e versionada (4 abas novas; nenhuma existente alterada)

`config_avaliacao` (configuração por turma+período+critério) · `rubricas_avaliacao` (uma linha por versão) · `avaliacao_rascunhos` (níveis, ajustes, histórico) · `evidencias_avaliacao` (por referência a registros existentes; origem, polaridade, preliminar). Todas passam pelo coordenador (versão, idempotência, log sem texto livre/JSON). Abas únicas (não se cria aba por semestre).

- **Criação:** Configurações → "Estrutura da avaliação" → `GET/POST /api/estrutura/avaliacao`. POST só adiciona abas ausentes + cabeçalho, é idempotente, **desligada por padrão** (`ESTRUTURA_AVALIACAO=ligada`), exige confirmação e checksum de backup (o backup é gerado pelo app; o servidor só confere o formato). Aba existente com cabeçalho diferente é apenas relatada.
- Leitura do servidor tolera abas ainda inexistentes (leem vazias).

### 4.5 Devolutiva (`devolutivaAvaliacao.ts`, aba Devolutiva da ficha)

Rascunho **determinístico**, sem IA, nunca enviado sozinho: notas oficiais lançadas, pontos fortes/em desenvolvimento/aprimoramento a partir do nível+descritor da rubrica, evidências (monitora só se aproveitada), atraso de registros semanais (fato mensurável, impacto "conforme os critérios da disciplina"), documentos pendentes (A conferir ≠ pendente), participação ("não constam registros" ≠ conduta). Cada item tem fonte; falta de dado vira "informação insuficiente" + lista de complementação. A revisão/aprovação/envio usa o `FeedbackModal` existente.

### 4.6 Controle de RSS (simplificado e automático)

Decisão: **sem etapa de validação individual**. `rssEntregas.ts` + `EntregasRssPainel` (ficha, aba Registros; resumo compacto para a monitora).
- **Dois status por semana:** ENTREGUE / NÃO ENTREGUE (semana ainda não exigível não tem status). Conta como entrega o registro `RECEBIDO`/`ENTREGUE`; `status_revisao` **não bloqueia** (o antigo "Em revisão" deixou de existir).
- **Associação automática** (fonte `registros_semanais`): unidade (matrícula; grupo na Clínica Ampliada) + turma + `semana_rss`. Semana vazia: usa a **data de entrega** dentro de uma semana do cronograma da turma (sem ocupar semana já entregue); **nunca** o número do encontro.
- **Esperado:** semanas encerradas no cronograma (`calendario_rss`) da turma; total previsto = regra/situação da turma (padrão 12).
- **Mostra:** realizadas, previstas no semestre, semanas entregues, semanas pendentes e atraso **discreto** (só com data confiável posterior ao fim da semana; informativo, não altera status nem nota).
- **Dado ausente ≠ não entregue:** sincronização incompleta → nenhuma semana é marcada como não entregue. Entrega sem semana identificada conta no total, mas nenhuma semana específica é acusada até ser associada (a contagem de entregas faltantes continua exata).
- **Correção auditável:** `rss_ajustes` (aditiva, coordenador com versão e log): associar um registro a outra semana/unidade (guarda semana/unidade originais), desfazer (status REVOGADO; nada é apagado) e **observações pontuais** por semana. A fonte nunca é alterada.
- **Sem desconto:** nenhuma nota, rubrica, pontuação por RSS nem desconto automático. RSS não é critério da avaliação. RSS atrasado continua fora das pendências e notificações.
- **Verificação com a planilha anonimizada (86 matrículas):** 0 entregas perdidas em relação à contagem anterior; 48 matrículas passam a contar entregas antes bloqueadas por "revisão" ou sem semana.

## 5. Permissões e segurança

**Perfis** (decididos no servidor; configuração no Worker, não na planilha, para que quem edita a planilha não conceda acesso a si mesmo):

| Perfil | Como é definido | Pode |
|---|---|---|
| `PROFESSORA_ADMIN` | `ADMIN_EMAILS` ou `ACESSOS_JSON.administradoras` | tudo; lê a planilha com o próprio acesso Google; sincroniza; vê log e backup |
| `MONITORA` | `ACESSOS_JSON.monitoras[]` = `{email, turmas[], operacoes[]}` | só as **operações delegadas** nas **turmas listadas** |
| Estudante | — | **sem acesso** nesta versão |

`ACESSOS_JSON` (exemplo): `{"monitoras":[{"email":"m@x.com","turmas":["<turma_id>"],"operacoes":["CHAMADA","DOCUMENTOS_VER"]}]}`.
Entradas inválidas (sem turma, sem operação, `"*"`, e-mail ruim) são **ignoradas** e aparecem como aviso para a administradora.

| Operação delegável | Grava | Lê (filtrado à turma) |
|---|---|---|
| `CHAMADA` | `frequencias`, `encontros_turma` | `encontros_turma`, `frequencias` (sem `justificativa`/`observacao`) |
| `ENTREGAS` | `entregas` | `entregas` e o **status administrativo de RSS** por lista branca de colunas: `registros_semanais` (registro, matrícula/grupo, turma, escopo, data, semana, status), `status_rss_unidades`, `calendario_rss`, `regras_rss`, `situacao_atual_turmas` (só totais) e `rss_ajustes` (sem observação/autoria). **Nunca** objetivos, técnicas, manejo, dúvidas, limitações, autora nem qualquer coluna nova |
| `DOCUMENTOS_VER` | — | `monitoramento_documentos` (sem observações manuais) e estado da sincronização |
| `CONTRIBUICAO_AVALIATIVA` | `evidencias_avaliacao`, **somente** contribuição **preliminar** e **própria** (origem `CONTRIBUICAO_MONITORA`, autoria = a conta, até 600 caracteres; sem alterar autoria/turma/origem; sem exclusão; sem editar o que a professora já aproveitou) | `rubricas_avaliacao` (sem motivos/autoria) e as **próprias** contribuições. **Nunca** notas, rascunhos, configuração nem evidências da professora |
| (sempre) | — | períodos, disciplinas, turmas, horários, matrículas, alunos (sem e-mail), grupos |

**Nunca para monitora:** avaliações, ocorrências, devolutivas/feedbacks, registros de supervisão, orientações, pontos de acompanhamento, **conteúdo de RSS**, critérios, configurações, log, backup, cadastro; exclusões; sincronização manual. Turma indeterminada = negado; o servidor confere a turma do registro novo **e** a do registro existente.

**Medidas**
- Identidade: token de ID do Firebase verificado no Worker (assinatura, emissor, público, validade, e-mail verificado; rotação de chaves tratada). O e-mail enviado no corpo é ignorado.
- Falha fechada: sem `ADMIN_EMAILS`/`ACESSOS_JSON` → 503. Monitora/sincronização sem conta de serviço → 503.
- A monitora **não usa credencial Google própria**: o servidor grava e lê com a conta de serviço depois de validar perfil, tabela e turma.
- Log de alterações com identidade verificada; texto livre nunca vai ao log; falha do log não desfaz a gravação (reenvio automático).
- Sincronização: só `id, modifiedTime, trashed, parents`; sem nome, conteúdo, revisões ou links; uma execução por vez.
- Variáveis de teste (`SHEETS_API_BASE`, `DRIVE_API_BASE`, `TOKEN_URL`, `JWKS_URL`) só valem se apontarem para `127.0.0.1`/`localhost`.

**Limites conhecidos (não resolvidos)**
1. A **administradora** ainda lê/escreve cadastros não migrados direto na planilha com o próprio token; o controle dela é o compartilhamento Google.
2. Quem tiver acesso de edição à planilha pelo Google contorna o app. Para as monitoras, **não compartilhe a planilha com elas** (o servidor usa a conta de serviço).
3. O cache local é do navegador: na troca de conta a cópia das tabelas é apagada; se houver alterações pendentes de outra conta, nada é apagado e a troca é sinalizada.
4. Texto livre de RSS/ocorrências ainda é exibido por inteiro à administradora (E2/E4).

---

## 6. Estado por funcionalidade

| Funcionalidade | Estado | Observações |
|---|---|---|
| Autorização e identidade no servidor | ✅ | §5 |
| Perfis PROFESSORA_ADMIN e MONITORA por turma | ✅ servidor · 🟡 interface | monitora não vê Avaliação/Semestres/Configurações nem as abas confidenciais da ficha (implementado; não exercitado no navegador com perfil monitora) |
| Leitura filtrada para monitora (`/api/leitura`) | ✅ | exige conta de serviço |
| Controle de versão + log em 23 tabelas | ✅ | 7 originais + 7 de acompanhamento + 9 de cadastro (`alunos`, `matriculas`, `turmas`, `horarios_turma`, `periodos`, `disciplinas`, `turmas_origem`, `grupos_pratica`, `grupo_integrantes`), um commit cada, reversível |
| Cadastros restantes (4 tabelas) | ❌ | ver §3: risco de sobrescrever fórmulas / dependem de D3 |
| Backup v2.0 (checksum) · conferência · restauração por registro | ✅ | restauração testada só em planilha simulada |
| `monitoramento_documentos` na turma e na ficha (aluno e grupo) | ✅ | existência, data de modificação, data de verificação, status, erros e "a conferir" |
| Condição `SUPERVISAO_HORARIO_ALTERNATIVO` (Olyver: matrículas 2B e 3B) | ✅ regra e interface · ⏸ dados reais | selo na turma, ficha e chamada; sem presença/falta automática |
| Conferência dos vínculos da aba real (Configurações) | ✅ | roda no navegador da administradora |
| Sincronização Drive→planilha ("Sincronizar agora", lock, histórico, falhas) | ✅ simulado · ⏸ real | só administradora |
| Cron 08:00 e 18:00 (Brasília) | ⏸ | lógica e horários testados; **não declarados** em `wrangler.jsonc` |
| Chamada: `NAO_REGISTRADO` até encerrar, prévia e confirmação explícita (D1) | ✅ local/simulado | modal "Encerrar chamada"; nada é gravado antes de confirmar; clique duplo não duplica. Retificação com justificativa de chamada já encerrada: ❌ |
| Cache local limpo na troca de usuária | ✅ | preserva e sinaliza pendências de outra conta |
| Engine de avaliação: oficial × prévia × prazo × divergência; nota inválida sinalizada; cálculo unificado entre telas | ✅ simulado | §4.1–4.2 |
| Rubrica de Documentação (6 subcritérios, níveis, descritores por estágio, versões, ajuste justificado, confirmação explícita) | ✅ simulado | §4.3; Consultoria Organizacional preparada, descritores a definir |
| Estrutura aditiva (4 abas) e painel "Estrutura da avaliação" | ✅ simulado e workerd · ⏸ **abas não criadas na planilha** | §4.4; criação desligada por padrão |
| Evidências (linha do tempo) e contribuição preliminar da monitora | ✅ simulado | §5 |
| Avaliação parcial e final (resumo/conferência) | ✅ simulado | sem nota final, média parcial nem projeção |
| Devolutiva: rascunho determinístico com fonte por frase | ✅ simulado | §4.5; aprovação/envio no modal existente |
| Participação (registro estruturado), diário, marcos, competências | ❌ | E3–E5 restante |
| RSS original imutável e conferência de vínculos | ❌ | E4 |
| Resumos por turma (RSS 7 dias, documentos) e quadro "Marcar entregas" | ✅ | consulta, sem notificação |

---

## 7. Testes e evidências

Comandos: `npm run lint` · `npm test` (41 arquivos) · `npm run build` · `npm run test:worker-real` (também no CI).

| Prova | Cobertura | Resultado |
|---|---|---|
| `testAutorizacao` | token expirado/forjado/`alg:none`/outra chave, rotação de chaves, falha fechada, identidade do corpo ignorada, Origin, exports do Worker | ✅ |
| `testPerfis` | configuração, matriz de escrita, leitura filtrada, conta de serviço (assinatura JWT conferida), monitora × administradora ponta a ponta | ✅ |
| `testMigracaoCadastro` | por tabela (`alunos`, `matriculas`, `turmas`, `horarios_turma`): edição, preservação de colunas, conflito, exclusão com versão | ✅ |
| `testAuditoriaLog`, `testE1Integracao`, `testBackup` | log sem texto livre, idempotência, conflito, restauração | ✅ |
| `testMonitoramentoDocumentos` | recência por data, Olyver (duas matrículas, documentos separados), grupo coletivo uma vez, condição de horário alternativo | ✅ |
| `testSincronizacaoDocumentos` | só metadados, 4 colunas, sem duplicar, uma por vez, 08:00/18:00, falhas, histórico; mutação deliberada foi detectada | ✅ |
| **`test:worker-real`** (workerd + planilha, Drive e Google simulados em loopback, conta de serviço falsa) | sem identidade 401; conta sem papel 403; administradora 200 + log; reenvio idempotente; versão antiga 409; simultâneas 200+409; **monitora**: grava só com a conta de serviço, outra turma 403 `FORA_DA_TURMA`, nota 403, leitura de avaliações 403, leitura filtrada (sem e-mail/justificativa/observação); **sincronização** manual (403 monitora), duas simultâneas 200+409, **cron `0 11 * * *` e `0 21 * * *` executam, outro cron é ignorado**, histórico `AGENDADO`; corpo > 128 KB 413 | ✅ |
| `testAvaliacaoEngine`, `testAvaliacaoUnificacao`, `testAvaliacaoEstruturaReal`, `testRubricasAvaliacao`, `testEstruturaAvaliacao`, `testContribuicaoMonitora`, `testDevolutivaAvaliacao`, `testQuadroAvaliacaoPrazo` | oficial×prévia×prazo; ficha 4,29 preservada; unificação (soma idêntica à legada, inválido sinalizado); estrutura real 6×8=10,0; rubrica/níveis/versões/grupo; persistência pelo coordenador e criação idempotente de abas; permissões da monitora no handler do Worker; devolutiva | ✅ |
| Navegador (planilha simulada, dados anonimizados) | painel de documentos na turma e na ficha (grupo uma vez; individual por matrícula); selo de horário alternativo; chamada enviou 13 de 14 matrículas (a alternativa ficou de fora); backup baixar/conferir/restaurar; botão "Sincronizar agora" | ✅ |

**Defeito encontrado pelo runtime real:** `worker.ts` exportava auxiliares e o Cloudflare não inicia Worker assim; o CI anterior (`build` + `--dry-run`) não detectava. Corrigido e coberto por teste.

### Não validado com a planilha oficial e o Worker real ❗
- Nenhuma execução contra a planilha oficial, o Google, o Drive ou o Firebase **reais**. Os testes usam simulações fiéis à API.
- **Aba `monitoramento_documentos` real:** só foi possível confirmar pelo Drive que existe com **17 colunas × 3 linhas** (cabeçalho + 2 linhas). Os valores das células e os nomes exatos das colunas **não foram lidos**; a leitura é por nome de coluna e tolera extras, mas os cabeçalhos reais precisam conferir. Use *Configurações → Conferência de documentos e horário alternativo* (roda no seu navegador, sem enviar nada).
- **Vínculos do Olyver:** não verificados na planilha real (a matrícula 3B/2B e o valor em `papel_na_turma`). A mesma conferência lista as matrículas marcadas.
- Conta de serviço, `ACESSOS_JSON` e Cron Triggers reais.

---

## 8. Ativar a sincronização (somente após validar)

1. Preview do Worker com `GOOGLE_SERVICE_ACCOUNT_JSON` (segredo) e **cópia** da planilha; planilha e arquivos compartilhados com a conta de serviço.
2. Abrir *Configurações → Conferência* e corrigir erros de vínculo.
3. Definir `SINCRONIZACAO_DOCUMENTOS=ligada` e clicar **Sincronizar agora**; conferir as 4 colunas, que as observações manuais ficaram intactas e a linha `DRIVE_METADADOS` em `sincronizacao`.
4. Só então adicionar a `wrangler.jsonc`:
```jsonc
"triggers": { "crons": ["0 11 * * *", "0 21 * * *"] }   // 08:00 e 18:00 em Brasília (UTC−3, sem horário de verão)
```
O teste `testSincronizacaoDocumentos` recusa qualquer outro valor. **Desligar:** remover a variável (o cron passa a ignorar) ou o bloco `triggers`.

---

### 8.1 Criar a estrutura da avaliação (somente numa CÓPIA primeiro)

1. Configurações → Backup → baixar e conferir o backup. 2. No Worker: `ESTRUTURA_AVALIACAO=ligada`. 3. Configurações → "Estrutura da avaliação" → Verificar → baixar backup verificado → confirmar → criar. 4. Conferir na planilha: 4 abas só com cabeçalho; nenhuma aba existente alterada. 5. Só então configurar a rubrica por turma. **Reversão:** apagar as 4 abas novas (nenhum dado existente depende delas) e desligar a variável.

## 9. Plano de reversão

| Mudança | Como reverter |
|---|---|
| Autorização/perfis | `git revert` dos commits E2; sem `ADMIN_EMAILS` nada grava (não reabre acesso) |
| Cada tabela coordenada | remover o nome de `TABELAS_CRITICAS` (um commit por tabela) |
| Log | apagar a aba `log_alteracoes` |
| Sincronização | desligar a variável; apagar linhas `DRIVE_METADADOS` se desejado; as 4 colunas voltam a ser editáveis à mão |
| Apps Script | `git revert 59ea391` |
| Restauração de registro | cada uma tem linha no log com antes/depois |

---

## 10. Próximas etapas priorizadas

1. **Validação real (bloqueia o resto):** itens de §1 e §8 numa cópia da planilha; conferir cabeçalhos e vínculos do Olyver.
2. **E2 restante:** conferir e migrar as 4 tabelas restantes; decidir D5.
3. **E3 restante:** retificação de chamada encerrada; falta/atraso/justificativa/dispensa separados (D2, depende do regulamento); diário e participação.
4. **E4:** RSS original imutável, tela de conferência de vínculos, janela operacional de 7 dias sem cortar histórico.
5. **E5 restante:** descritores da Consultoria Organizacional; competências; rubricas de Participação e Desempenho (pesos internos aguardam sua aprovação — hoje seguem manuais); registro estruturado de participação; decidir a associação de "Registros semanais" × "Seminário/Atividade avaliativa".
6. **E6:** menu (Agenda/Acervo), pendências tipadas, fechamento semestral.
