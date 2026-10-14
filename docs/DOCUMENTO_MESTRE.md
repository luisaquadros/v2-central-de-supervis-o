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
| RSS | `registros_semanais` (fórmula, somente leitura) | formulário/planilha | app | original imutável ainda não preservado (E4) |
| Avaliações e rubricas | `avaliacoes`, `avaliacoes_completas`, `criterios_avaliacao` | app (coordenador) | só administradora | rubrica versionada: ❌ (E5) |
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
| `ENTREGAS` | `entregas` | `entregas` |
| `DOCUMENTOS_VER` | — | `monitoramento_documentos` (sem observações manuais) e estado da sincronização |
| (sempre) | — | períodos, disciplinas, turmas, horários, matrículas, alunos (sem e-mail), grupos |

**Nunca para monitora:** avaliações, ocorrências, devolutivas/feedbacks, registros de supervisão, orientações, pontos de acompanhamento, RSS, critérios, configurações, log, backup, cadastro; exclusões; sincronização manual. Turma indeterminada = negado; o servidor confere a turma do registro novo **e** a do registro existente.

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
| Condição `SUPERVISAO_HORARIO_ALTERNATIVO` (estudante com supervisão alternativa: matrículas 2B e 3B) | ✅ regra e interface · ⏸ dados reais | selo na turma, ficha e chamada; sem presença/falta automática |
| Conferência dos vínculos da aba real (Configurações) | ✅ | roda no navegador da administradora |
| Sincronização Drive→planilha ("Sincronizar agora", lock, histórico, falhas) | ✅ simulado · ⏸ real | só administradora |
| Cron 08:00 e 18:00 (Brasília) | ⏸ | lógica e horários testados; **não declarados** em `wrangler.jsonc` |
| Chamada: `NAO_REGISTRADO` até encerrar, prévia e confirmação explícita (D1) | ✅ local/simulado | modal "Encerrar chamada"; nada é gravado antes de confirmar; clique duplo não duplica. Retificação com justificativa de chamada já encerrada: ❌ |
| Cache local limpo na troca de usuária | ✅ | preserva e sinaliza pendências de outra conta |
| Participação, diário, marcos, rubricas, competências, devolutiva com evidência | ❌ | E3–E5 |
| RSS original imutável e conferência de vínculos | ❌ | E4 |
| Resumos por turma (RSS 7 dias, documentos) e quadro "Marcar entregas" | ✅ | consulta, sem notificação |

---

## 7. Testes e evidências

Comandos: `npm run lint` · `npm test` (32 arquivos) · `npm run build` · `npm run test:worker-real` (também no CI).

| Prova | Cobertura | Resultado |
|---|---|---|
| `testAutorizacao` | token expirado/forjado/`alg:none`/outra chave, rotação de chaves, falha fechada, identidade do corpo ignorada, Origin, exports do Worker | ✅ |
| `testPerfis` | configuração, matriz de escrita, leitura filtrada, conta de serviço (assinatura JWT conferida), monitora × administradora ponta a ponta | ✅ |
| `testMigracaoCadastro` | por tabela (`alunos`, `matriculas`, `turmas`, `horarios_turma`): edição, preservação de colunas, conflito, exclusão com versão | ✅ |
| `testAuditoriaLog`, `testE1Integracao`, `testBackup` | log sem texto livre, idempotência, conflito, restauração | ✅ |
| `testMonitoramentoDocumentos` | recência por data, estudante com supervisão alternativa (duas matrículas, documentos separados), grupo coletivo uma vez, condição de horário alternativo | ✅ |
| `testSincronizacaoDocumentos` | só metadados, 4 colunas, sem duplicar, uma por vez, 08:00/18:00, falhas, histórico; mutação deliberada foi detectada | ✅ |
| **`test:worker-real`** (workerd + planilha, Drive e Google simulados em loopback, conta de serviço falsa) | sem identidade 401; conta sem papel 403; administradora 200 + log; reenvio idempotente; versão antiga 409; simultâneas 200+409; **monitora**: chamada bloqueada inclusive na própria turma, outra turma 403 `FORA_DA_TURMA`, nota 403, leitura de avaliações 403, leitura filtrada (sem e-mail/justificativa/observação); **sincronização** manual (403 monitora), duas simultâneas 200+409, **cron `0 11 * * *` e `0 21 * * *` executam, outro cron é ignorado**, histórico `AGENDADO`; corpo > 128 KB 413 | ✅ |
| Navegador (planilha simulada, dados anonimizados) | painel de documentos na turma e na ficha (grupo uma vez; individual por matrícula); selo de horário alternativo; chamada enviou 13 de 14 matrículas (a alternativa ficou de fora); backup baixar/conferir/restaurar; botão "Sincronizar agora" | ✅ |

**Defeito encontrado pelo runtime real:** `worker.ts` exportava auxiliares e o Cloudflare não inicia Worker assim; o CI anterior (`build` + `--dry-run`) não detectava. Corrigido e coberto por teste.

### Não validado com a planilha oficial e o Worker real ❗
- Nenhuma execução contra a planilha oficial, o Google, o Drive ou o Firebase **reais**. Os testes usam simulações fiéis à API.
- **Aba `monitoramento_documentos` real:** só foi possível confirmar pelo Drive que existe com **17 colunas × 3 linhas** (cabeçalho + 2 linhas). Os valores das células e os nomes exatos das colunas **não foram lidos**; a leitura é por nome de coluna e tolera extras, mas os cabeçalhos reais precisam conferir. Use *Configurações → Conferência de documentos e horário alternativo* (roda no seu navegador, sem enviar nada).
- **Vínculos do estudante com supervisão alternativa:** não verificados na planilha real (a matrícula 3B/2B e o valor em `papel_na_turma`). A mesma conferência lista as matrículas marcadas.
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

1. **Validação real (bloqueia o resto):** itens de §1 e §8 numa cópia da planilha; conferir cabeçalhos e vínculos do estudante com supervisão alternativa.
2. **E2 restante:** conferir e migrar as 4 tabelas restantes; decidir D5.
3. **E3 restante:** retificação de chamada encerrada; falta/atraso/justificativa/dispensa separados (D2, depende do regulamento); diário e participação.
4. **E4:** RSS original imutável, tela de conferência de vínculos, janela operacional de 7 dias sem cortar histórico.
5. **E5:** rubricas versionadas, competências, devolutiva com evidência (D3).
6. **E6:** menu (Agenda/Acervo), pendências tipadas, fechamento semestral.

## 8. Checkpoint Codex — 14/10/2026

### Referências e arquitetura efetiva
PR #46 permanece **aberto, não integrado**, head `3cf4bc2`; main `d707105`. Trabalho isolado em branches próprias: estabilização `bf6bb05`, PRISMA `3c2b4b6`, gestão/homologação sobre essa base. Nenhum merge, deploy, alteração de credencial, migração D1 ou escrita nos recursos externos.

React → serviços/contexto → autenticação Firebase verificada no Worker → coordenador serial por planilha → Google Sheets. Cada escrita crítica usa identidade verificada, ID de operação, base de comparação, recibo durável e log. Resposta perdida é reconciliada antes de repetir; a fila conserva o mesmo ID/corpo depois do primeiro envio. IndexedDB é cache/fila, não prova de gravação remota. Conflitos exigem revisão; adotar a versão oficial arquiva a proposta local, sem sobrescrevê-la automaticamente. Conta/titular da fila e do token OAuth são conferidos.

### Gestão contínua, sem novas abas por semestre
- `semestreService`: valida identificação/datas, remapeia IDs de turmas e critérios, reutiliza o catálogo de disciplinas, cria nova vigência de horários e marco de início das aulas quando fornecido. Não copia matrículas, notas, frequências, RSS, documentos, pareceres ou cancelamentos/reagendamentos antigos. Competências/modelos/regras administrativas sem modelo canônico confirmado não são copiados automaticamente.
- Rubrica herdada: `A_CONFERIR`; professora confere explicitamente. Pontos máximos/pesos e descrições vêm dos critérios existentes. Critério usado em avaliação não é editado em lugar; versionamento formal permanece pendente. Validação das avaliações detalhadas verifica critérios, escopo, limites e consistência com a soma já utilizada pela interface; não muda pesos ou notas armazenadas.
- CSV de cronograma: prévia, datas explícitas, origem/status/escopo, bloqueio de repetidos, somente inserção. Datas ausentes não são estimadas. Edição de marco existente ainda depende de interface específica; importação não substitui registros.
- Inscrição: Google Forms institucional existente + QR local; importação das respostas por CSV pela professora. Usa `alunos` e `matriculas`, com `PENDENTE` antes da aprovação; rejeição mantém matrícula cancelada. RA identifica cadastro existente; conferência humana precede recebimento, sem atualizar dados pessoais antigos silenciosamente. Abrir/fechar respostas e coleta automática continuam no Forms; integração automática não foi provisionada.
- Grupos: criação/vínculos datados apenas no contexto coletivo reconhecido pelas regras existentes; IDs próprios, membros por matrícula, vínculos ativos não duplicados e controle de turma no servidor. Documentação coletiva continua uma referência única.
- Encerramento: conferência de pendências conhecidas/fila/avaliações + declaração explícita de revisão docente. Servidor também recusa inscrições/rubricas/avaliações pendentes; período arquivado bloqueia edições comuns inclusive por chamadas diretas. Arquivo não significa homologação de notas, nem validação automática de reposições/pareceres ainda sem módulo. Retificação formal não está habilitada.

### Confiabilidade e segurança
- Monitoras não escrevem frequências/encontros, mesmo com delegação legada `CHAMADA`; leitura legada permanece filtrada e sem justificativas/observações. Negação acontece antes de solicitar credencial Google. Notas, critérios e ocorrências continuam restritos no servidor.
- Validação de período da matrícula, RA/matrícula duplicados, critério de outra turma, grupo/integrante incompatíveis, identidade imutável da matrícula, chamada encerrada e relações antes de exclusão. Frequências e avaliações não têm exclusão comum.
- `avaliacoes_completas`: validação dos critérios dentro do JSON, evitando limite inválido, critério repetido/alheio ou total inconsistente. Rascunho permanece distinto de conclusão.
- Logs ocultam textos pessoais/livres e JSON estruturado (incluindo comentários dentro da rubrica). Mantêm autor verificado, horário, operação, campos e valores escalares necessários.
- `/api/diagnostico`: autenticado, somente professora, mostra observação real do Worker/bindings. Configuração não equivale a acesso Google. Interface usa datas reais de leitura/escrita e fila; documentos e backup conservam seus painéis de conferência.
- Drive: somente metadados, execução serial, estados de acesso/arquivo/conferência separados. `0 11 * * *` e `0 21 * * *` correspondem a 08h/18h em Brasília, conforme configuração/testes locais. **Agendamentos não ativados.**
- Backup v2: checksum/contagens/referências, dados operacionais, fila/titular e arquivos de recuperação. Restauração por registro via mesma persistência, sem exclusão do trabalho posterior. Retenção institucional não definida; nenhuma limpeza automática. Cache/backup local exigem política para dispositivos compartilhados e proteção institucional.

### Evidências e cobertura
Fontes externas consultadas **somente em leitura**: especificação v1.2/anexo, metadados/cabeçalhos da planilha de desenvolvimento, amostra dos oito critérios e ACLs da planilha/pasta fornecidas. Não apareceu permissão pública nesses dois recursos; não equivale a auditoria completa do Drive ou a teste da conta de serviço. Não foi lido conteúdo clínico.

37 programas de teste, TypeScript, build, auditoria de dependências, Worker real local (`workerd`) e navegador. O cenário 2027.1 usa 3 turmas, 54 matrículas/51 alunos, vínculos em duas turmas, matrícula alternativa, 3 grupos/18 integrantes, 6 semanas, 318 frequências e 18 encontros. Cobre inscrições pendentes/aprovação, rubrica/copiar/confirmar, zero versus ausência, replay, nota de outro contexto, bloqueio de alteração após fechamento, arquivo e histórico. QR decodificado opticamente; backup conferido e restauração efetiva exercitada pelo teste de backup em planilha simulada.

UI: nove telas claro/escuro, cinco cenários de interação, 320–1440 px/lista de 60 pessoas, foco/escape de modal e menu, contraste/axe WCAG 2/2.1/2.2 AA, prévia sem gravação, confirmação explícita, erro preservando formulário, nota digitada mantida na sincronização, ausência de dados sem falso “regular”. Artefatos locais em `artifacts/ui-prisma/`; reprodução: `npm run test:ui` (Chromium instalado ou `CHROMIUM_PATH`). CI inclui testes UI, sem autorização de produção.

**Distinções:** navegador usa API simulada; handler/coordenador usam Sheets/Drive/JWKS simulados; `workerd` é runtime real local com APIs simuladas. Leituras externas de metadados são reais. Não houve teste de escrita/restauração/Google/Firebase reais ou produção, nem leitor de tela/dispositivo físico.

### Diagnóstico e pendências
**PARCIALMENTE CONCLUÍDO · NÃO APTO para homologação do semestre completo.**

| Prioridade | Situação |
|---|---|
| P0 | Falhas reproduzidas de permissão de chamada, vínculo cruzado, exposição de JSON em log e estados falsos corrigidas/mitigadas no escopo testado. Infraestrutura/autorização reais não homologadas. |
| P1 | Participação/diário/competências estruturados, ciclo de reposição conforme D2, pareceres de monitoras/revisão docente, homologação/versionamento oficial e retificação formal ainda incompletos. Não simulados como sucesso. |
| P2 | Criação/clonagem/importação é sequencial, não transação entre tabelas: interrupção preserva progresso/fila, exige conferência antes de repetir. Coleta automática/abertura-fechamento do Forms, correção de inscrição já recebida, edição de marcos, política de retenção/cache/backup e teste de escala de vários anos pendentes. |
| P3 | Componentes legados ainda usam utilidades antigas; migração gradual de tokens e avaliação manual assistiva/dispositivos físicos. |

Próxima intervenção humana: confirmar as definições institucionais e a base canônica; disponibilizar ambiente/cópia e contas de teste autorizadas para validar identidade, conta de serviço, gravação, Drive e recuperação reais. Conferir implantações/gatilhos GAS antes de qualquer merge: ausência de referência ativa no código não comprova ausência de implantação externa. Nenhuma autorização de produção é inferida deste checkpoint.


**Correções finais do checkpoint:** base de versão da avaliação acompanha o formulário desde o início da edição, mesmo após sincronização do cache; teste mantém proposta 7, servidor 8 e base original 5, recusando sobrescrita. Avaliação de semestre vazio não reutiliza turma/notas do período anterior. Datas de chamada são conferidas contra a vigência conhecida do período. Calendário/documentação ausentes exibem “não verificado”, sem falso “em dia”. Auditoria automatizada inclui painel desktop além dos temas mobile.

**Proteção adicional de cache:** proposta recusada por conflito permanece na fila, enquanto o cache restaura o snapshot anterior à proposta (teste: base 5, proposta 7, servidor/cache 8). Mudança observada de papel/turmas/operações invalida a interface antes de uma nova leitura. Monitoras só recebem o snapshot filtrado pelo servidor, inclusive com fila pendente; não recebem propostas privadas antigas no painel de conflitos. Isso não substitui uma política institucional de dispositivos e armazenamento local.

**Referência revalidada na entrega:** main `d707105` permanece; PR #46 avançou de `3cf4bc2` para `a3d6cba` enquanto esta branch era desenvolvida, acrescentando avaliação formativa/RSS. Sem sobrescrita, merge ou deploy. A cobertura e as lacunas de §8 descrevem esta branch isolada, não a combinação ainda não testada com esses commits novos. Reconciliar antes de qualquer integração.
