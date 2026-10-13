# Fase 0 — Diagnóstico, aderência ao PRD e plano

Data: 13/10/2026 · Base analisada: `fix/backend-persistencia-integridade` (PR #46) · Somente leitura: **nenhuma alteração estrutural feita**.

> **Limite desta análise.** Recebi apenas o PRD. Faltam: Modelo de Dados e Integrações, Regras de Negócio e Avaliação, Guia de Interface e Matriz de Rastreabilidade. Onde o PRD remete a eles, marquei **[depende de doc]**. O PRD também diz (§19) que não houve inspeção integral do repositório; esta fase a faz, com as evidências abaixo.

---

## 1. Arquitetura atual

| Camada | O que existe | Observação |
|---|---|---|
| Cliente | React + Vite, arquivo único em `dist/` | ~29 mil linhas; 3 arquivos concentram a lógica: `SupervisaoContext.tsx` (3,2 mil), `ModoSupervisaoView.tsx` (1,4 mil), `AlunoFichaView.tsx` (1,3 mil) |
| Autenticação | Firebase Auth (Google) com escopo `spreadsheets` | **Sem papéis nem lista de permitidos no cliente.** Quem tem acesso à planilha tem acesso a tudo |
| Dados | Google Sheets API v4 direto do navegador; ~40 abas lidas em lote | Planilha "Central de Supervisão — DESENVOLVIMENTO" é a base. Leitura sempre completa |
| Escrita comum | Fila no aparelho (IndexedDB) → Sheets, célula a célula | Atualiza só colunas alteradas; não apaga fórmulas |
| Escrita crítica | `POST /api/critical-write` → Worker + Durable Object | 7 tabelas: `frequencias`, `encontros_turma`, `avaliacoes`, `avaliacoes_completas`, `documentos`, `entregas`, `leituras_responsaveis`. Serializa, compara versão (CAS), idempotente por `operacaoId`; corpo limitado a 128 KB |
| Legado | `gas/` (Apps Script) e `gasService.ts` | Caminho alternativo de gravação. Duplica regra de escrita |
| IA | Não há chamada a IA externa no código atual | Conforme §13 do PRD. Devolutiva é montada no cliente |
| Testes | 23 arquivos de teste Node (`npm test`), sem testes de interface automatizados | Fluxos de tela foram verificados à mão com navegador e planilha simulada |

**Telas atuais:** Hoje, Turmas, Frequência, Alunos, Avaliação, Calendário, Pendências, Semestres, Configurações, Modo Aula (`ModoSupervisaoView`) e Ficha do aluno.

**Fontes de verdade hoje (por entidade):** estudantes/matrículas/turmas/encontros/frequências/entregas/avaliações → abas da planilha oficial; RSS → aba `registros_semanais` (**gerada por fórmula, só leitura**) alimentada pela planilha de respostas; calendário RSS e marcos → abas por fórmula; notas parciais do caderno → abas `fonte_*` lidas por `NotasParciaisModal`.

---

## 2. Matriz de aderência ao PRD

Legenda: ✅ atende · 🟡 parcial · ❌ não atende · ❓ depende de documento/decisão

| § | Requisito | Situação | Evidência no código | Lacuna | Crit. |
|---|---|---|---|---|---|
| 3 | Menu: Hoje, Agenda, Turmas, Avaliações, Acervo | 🟡 | `Sidebar.tsx`: 9 itens, inclui **Alunos** e **Frequência** separados | Menu duplicado com Turmas/Encontro; falta "Agenda" e "Acervo" como áreas | Média |
| 4 | Encontro com ID estável e estados PLANEJADO→EM_ANDAMENTO→ENCERRADO / CANCELADO / REMARCADO | 🟡 | `StatusEncontro = PREVISTO\|REALIZADO\|NAO_REALIZADO\|REAGENDADO` | **Sem EM_ANDAMENTO**; sem início/fim efetivos; sem fuso; sem sequência | Alta |
| 4 | Encerrar só com confirmação do servidor, sem reabrir implicitamente | 🟡 | `chamada_salva: true` + escrita via Worker | Sem ação "encerrar" separada de "salvar chamada"; sem reabertura com justificativa | Alta |
| 4 | Retificação não muda histórico silenciosamente | ❌ | UPDATE sobrescreve a linha | Sem evento de retificação nem versão anterior | Alta |
| 4 | Dois encontros na mesma data | ❓ | Encontro identificado por turma+data em várias regras | Precisa teste (critério 1) | Alta |
| 5 | Presença com 6 estados incluindo NÃO_REGISTRADO | ❌ | `Frequencia.status` = PRESENTE / FALTA_SEM_JUSTIFICATIVA / FALTA_JUSTIFICADA / JUSTIFICATIVA_PENDENTE | Não há NÃO_REGISTRADO, ATRASO como estado, DISPENSADO | **Crítica** |
| 5 | Ausência de marcação nunca vira falta | 🟡 | `handleSalvarChamada`: **sem marcação = PRESENTE** (chamada por exceção); falta só se marcada | Sentido inverso ao PRD: silêncio vira presença. **Conflito de desenho a decidir** (ver D1) | **Crítica** |
| 5 | Participação como eventos múltiplos por encontro | ❌ | Não existe entidade `EventoDeParticipacao` | Só `observacao` livre na frequência | Alta |
| 5 | Um registro por matrícula/encontro/modalidade | 🟡 | ID de frequência estável por estudante+data | Não há "modalidade" | Média |
| 6 | Diário de supervisão | 🟡 | `registros_supervisao`, `preparacoes_aula`, orientações | Sem campos de pauta/combinados/decisões; sem rascunho de sessão interrompida | Média |
| 7 | RSS original imutável + normalizado | 🟡 | `registros_semanais` por fórmula (leitura) | Sem payload/hash/horário de coleta no app; normalização está na fórmula da planilha | Alta |
| 7 | Estados de qualidade (NÃO_VINCULADO, DUPLICADO_SUSPEITO…) | ❌ | Só `status_revisao = PENDENTE_REVISAO` | 38 registros em revisão sem tela de resolução | Alta |
| 7 | Homônimos não vinculados só por nome | 🟡 | Vínculo por `matricula_id` quando existe; leituras e importação usam nome | Risco na importação e nos 3 responsáveis de leitura sem vínculo | Alta |
| 7 | Entrega em dia / atrasada / prazo não encerrado | ✅ | `calcularMetricasCronogramaRss`, janela de 7 dias, resumo por turma | Falta "cobertura da fonte" (§7 e §8) | Média |
| 7 | Regra do semestre 31/08–21/11, feriado 20/11 só na sexta | 🟡 | Calendário RSS na planilha | Verificar exceções por turma (dependem de config versionada) | Média |
| 8 | Pendência tipada com condição, responsável, prioridade justificada | ❌ | `PendenciaCanonica` tem tipo e texto | Sem responsável, prazo, condição, "por que estou vendo isto" | Média |
| 8 | Hoje só mostra pendência acionável | ✅ | PR #46: RSS fora das pendências (69→6) | Documentos ainda vêm sem prazo/vencimento | Média |
| 9 | Rubrica versionada por turma, notas determinísticas e auditáveis | ❌ | `criterios_avaliacao` e `avaliacoes` sem versão de rubrica | Nota sem fundamento/versão gravados | **Crítica** [depende de doc] |
| 9 | Grupo e individual separados (Clínica Ampliada) | 🟡 | `grupos_pratica`, `grupo_integrantes` existem | Sem avaliação por grupo/EvidenciaDeGrupo | Alta |
| 10 | Ficha longitudinal por matrícula | 🟡 | `AlunoFichaView` (documentos oficiais já ligados) | Falta participação por modalidade e apresentações | Média |
| 10 | Devolutiva com link para evidência | ❌ | `FeedbackModal` monta texto | Sem vínculo afirmação→evidência | Alta |
| 11 | IDs estáveis, criado_por, fonte_original, versão | 🟡 | `criado_em/atualizado_em` na maioria; `versao` em 1 tipo | **Sem `criado_por`, `fonte_original`, versão** na maioria | Alta |
| 12 | Contrato de API versionado, idempotente, autorização no servidor | 🟡 | Worker: idempotência + CAS nas 7 críticas | Worker **não autoriza por usuário/papel**; só usa o token Google; demais tabelas vão direto do navegador sem CAS | **Crítica** |
| 12 | Estado de sincronização visível | ✅ | `SyncIndicator`, fila IndexedDB, retry | Sem carimbo de "última atualização real da fonte" | Baixa |
| 12 | Backup testado com restauração | ❌ | Exportação manual existe | Nenhuma restauração testada | Alta |
| 13 | Permissões, segregação, logs de operações sensíveis | ❌ | `auditoriaApp` (**só em memória**, `SupervisaoContext.tsx:618`) | Sem papéis; log se perde ao recarregar; aba `auditoria_base` não é alimentada pelo app | **Crítica** |
| 13 | Texto clínico identificável alertado/restrito | ❌ | Texto livre do RSS é exibido integralmente | Sem detecção/ocultação | Alta |
| 14 | Mobile-first, alvos grandes, não depender só de cor | 🟡 | Auditoria visual (docs) | Ajustar Modo Aula (tabela larga) e status só por cor | Média |
| 14 | Rascunho preservado sem rede | 🟡 | Fila local para gravações; rascunho de chamada ainda em memória | Sem política offline formal (D6) | Alta |
| 16 | 20 critérios de aceite | ❌ | Nenhum automatizado como tal | Ver §5 | — |

**Preservar (já funciona):** fila offline + Worker com CAS/idempotência; escrita célula a célula sem apagar fórmulas; RSS por turma sem pendência; resumos de RSS e documentos; ficha com entregas oficiais; alerta de fonte desatualizada.

---

## 3. Riscos de dados (evidenciados)

| # | Risco | Evidência | Impacto |
|---|---|---|---|
| R1 | **Silêncio = presença** na chamada por exceção | `ModoSupervisaoView.tsx:~270` | Se a professora esquecer de marcar, a presença é registrada como verdadeira. Oposto do PRD, que veta inventar presença |
| R2 | Sem trilha de auditoria persistida | `auditoriaApp` só em estado React | Alterações de notas/presenças não são rastreáveis; critério 7 e §13 falham |
| R3 | Sem controle de acesso por papel | sem papéis em `src/` | Qualquer conta com a planilha vê notas e ocorrências. Critério 17 falha |
| R4 | Sobrescrita sem histórico | UPDATE substitui valores | Correção de presença/nota apaga o valor anterior |
| R5 | Tabelas não críticas sem CAS | só 7 tabelas passam pelo Worker | Dois dispositivos editando `ocorrencias`, `orientacoes`, `feedbacks` podem perder dados |
| R6 | Vinculação por nome | importação do caderno, leituras (3 sem vínculo) | Homônimos, erros de grafia |
| R7 | Datas heterogêneas na planilha | "29/09 e 05/10/2026", "Set/2026" | Ordenação e prazos incertos (tratado na leitura, não na origem) |
| R8 | Dois caminhos de escrita (GAS e Sheets API) | `gas/` + `gasService.ts` | Regra duplicada; um deles pode ficar desatualizado |
| R9 | `registros_semanais` é fórmula | planilha | App não guarda o original imutável; edição manual na aba quebra a fórmula |
| R10 | Texto clínico em RSS | exibição integral | Exposição de narrativa identificável (§13) |
| R11 | Concentração de lógica | Contexto com 3,2 mil linhas | Difícil testar regras isoladamente; efeito colateral entre telas |
| R12 | Acesso Google expira (~55 min) | token em sessão | Gravações ficam na fila até reconectar; hoje avisa |

---

## 4. Decisões técnicas propostas

Princípio: **evoluir, não recriar**. Mantém React, Sheets como base e o Worker já existente.

| ID | Decisão | Motivo | Custo |
|---|---|---|---|
| T1 | Estender a **fila + Worker** para ser o único caminho de escrita (todas as tabelas), com CAS e idempotência | R5, R8; PRD §12 | Médio |
| T2 | Persistir **trilha de auditoria** na aba `auditoria_base` via Worker (quem, quando, tabela, id, antes/depois resumido, motivo) | R2, R4; §13 | Médio |
| T3 | **Papéis** (`PROFESSORA`, `APOIO`) em aba `usuarios_papeis`, aplicados no Worker (servidor) e na interface | R3; critério 17 | Alto [decisão D4] |
| T4 | Ampliar estados de **presença** (acrescentar NAO_REGISTRADO, ATRASO, DISPENSADO) mantendo valores atuais; migração só aditiva | R1; §5 | Médio [D1, D2] |
| T5 | Estados de **encontro**: acrescentar EM_ANDAMENTO e ENCERRADO (mapeando REALIZADO→ENCERRADO na leitura) e eventos de retificação | §4 | Médio |
| T6 | Nova aba `participacoes` (evento por aluno/encontro) em vez de colunas em `frequencias` | §5 critério 6 | Baixo |
| T7 | RSS: manter a fórmula como "normalizado"; criar **cópia imutável** (`rss_original`) com hash e coleta, e tela de **conferência** (NÃO_VINCULADO, DUPLICADO_SUSPEITO) | R6, R9; §7 | Médio |
| T8 | Rubrica versionada (`rubricas`, `rubrica_criterios`) e `lancamentos_nota` que guardam a versão usada | §9, critério 13 | Alto [depende de doc e D3] |
| T9 | Devolutiva: itens com `evidencia_ids`; sem evidência mostra "informação insuficiente" | §10; critério 15 | Médio |
| T10 | Fatiar `SupervisaoContext` por domínio (encontros, frequência, RSS, avaliação) **sem mudar comportamento**, com testes de caracterização | R11 | Médio |
| T11 | Exibição reduzida de texto livre do RSS (recolhido por padrão, aviso de sigilo) | R10; §13 | Baixo |
| T12 | Aposentar `gas/` e `gasService.ts` após confirmar que não são usados em produção | R8 | Baixo |

**Fonte de verdade proposta:** planilha oficial para cadastro e registros; Worker como único escritor; formulário de RSS como origem do RSS (aba `rss_original` como espelho imutável).

---

## 5. Plano por etapas verificáveis

Cada etapa só fecha com testes automáticos, verificação no navegador com dados pseudonimizados e reversão possível.

| Etapa | Entrega | Critérios do PRD cobertos | Evidência exigida |
|---|---|---|---|
| **E0** | Este diagnóstico + aceite das decisões D1–D7 | — | Aprovação sua |
| **E1 — Integridade** | T1, T2, T12; teste de restauração de backup | 3, 4, 18, 20 | Testes de CAS em todas as tabelas; log persistido visível; restauração em cópia isolada |
| **E2 — Segurança** | T3, T11 | 16, 17 | Teste de API com perfil limitado recebendo 403; texto clínico recolhido |
| **E3 — Chamada correta** | T4, T5 (+ T6 para participação) | 1, 2, 5, 6, 7, 12, 19 | Testes de unidade dos estados; roteiro no celular: Hoje→encontro→chamada→participação→diário→encerrar |
| **E4 — RSS confiável** | T7 | 8, 9, 10 | Casos '1', '01', texto livre e homônimos em teste; tela de conferência |
| **E5 — Avaliação** | T8, T9 | 11, 13, 14, 15 | Nota recalculada de forma determinística; versão preservada |
| **E6 — Consolidação** | Menu (Agenda/Acervo), pendências tipadas, fechamento semestral, T10 | 19, 20 | Reconciliação de totais antes/depois |

Ordem recomendada: **E1 → E2 → E3 → E4 → E5 → E6**. E1 e E2 vêm primeiro porque tudo o mais depende de gravar com segurança e rastrear.

---

## 6. Decisões que preciso de você (PRD §18, sem inventar)

| ID | Pergunta | Alternativas | Recomendação |
|---|---|---|---|
| **D1** | Chamada: manter "todos presentes, marco só as exceções" ou exigir marcação explícita? | (a) Exceção atual; (b) NÃO_REGISTRADO por padrão e botão "todos presentes" de 1 toque; (c) exceção, mas só vale após "Encerrar chamada" confirmado | **(c)**: mantém a rapidez de hoje e deixa explícito que você confirmou. O estado cru continua NÃO_REGISTRADO até confirmar |
| D2 | Regras de falta, atraso, justificativa e reposição | Regulamento da instituição | Preciso do texto para fixar ATRASO e DISPENSADO |
| D3 | Rubrica e peso de apresentações e leituras/estudos dirigidos por turma | Doc "Regras de Negócio e Avaliação" | Não implementar nota antes disso |
| D4 | Quem mais acessa (monitoras/apoio) e o que veem | Só professora; ou apoio sem notas | Começar só com `PROFESSORA` e `APOIO` sem notas/ocorrências |
| D5 | Qual fonte vence em conflito entre planilhas | Planilha oficial vs. respostas vs. Central de Controle | Oficial vence; respostas só entram como RSS |
| D6 | Política de edição offline | (a) Só leitura offline; (b) gravar com fila e aviso | **(b)**, que é o que o app já faz; formalizar o aviso |
| D7 | Retenção e exportação de dados | Norma da instituição/LGPD | Definir antes de E2 |

---

## 7. O que NÃO farei sem aprovação
Alterar regras de nota, pesos, faltas ou prazos; gravar na planilha oficial; apagar abas ou colunas; migrar dados históricos.

---

## 8. Estado da E1 — Integridade (13/10/2026)

| Item | Situação | Evidência |
|---|---|---|
| T2 — Trilha de auditoria persistida | ✅ feito | O Worker grava uma linha em `log_alteracoes` por alteração confirmada (quem declarou, tabela, id, ação, campos, antes/depois). **Texto livre nunca vai para o log** (só "(texto)"). Aba criada na primeira gravação. Reenvio idempotente não duplica; se o log falhar, a gravação vale e o log é reenviado na operação seguinte. Teste: `testAuditoriaLog.ts` |
| T1 — Controle de versão em mais tabelas | 🟡 parcial | Passam a usar o coordenador: `ocorrencias`, `orientacoes`, `feedback_alunos`, `feedbacks`, `pontos_acompanhamento`, `registros_supervisao`, `preparacoes_aula` (somam-se às 7 anteriores). Ficam no caminho direto, de propósito: `alunos`, `matriculas`, `turmas`, `horarios_turma`, `periodos`, `disciplinas`, `configuracoes`, `marcos_academicos`, `criterios_avaliacao`, `grupos_pratica`, `grupo_integrantes`, `registros_semanais` (cadastro e abas com adaptação própria; migrar uma a uma em etapa seguinte) |
| Conflito falso por formato de data | ✅ corrigido | A comparação de versão leva `13/10/2026`, número de série e ISO ao mesmo formato; sem isso as tabelas migradas travariam em "conflito" sempre que a planilha tivesse data em formato brasileiro |
| Prova ponta a ponta | ✅ | `testE1Integracao.ts`: tela → fila local → coordenador → planilha simulada. Edição válida grava e deixa 1 linha de log; aparelho com versão antiga recebe `CONFLITO_VERSAO` e **não** mostra "salvo"; valor do outro aparelho é preservado |
| T12 — Aposentar `gas/` | ✅ feito | Confirmado que só o Cloudflare está em produção. Removidos `gas/`, `gasService.ts`, os 32 ramos `isRunningInAppsScript` (os `!isRunningInAppsScript` viraram o caminho único) e as abas de implantação do Apps Script em Configurações |
| E1.3 — Backup com restauração | ✅ feito | Backup v2.0 com contagens e checksum SHA-256. "Conferir um backup" valida o arquivo (checksum, chaves duplicadas, referências) **sem alterar nada** e lista o que difere da planilha. Restauração é **um registro por vez**, com confirmação, pelo mesmo caminho das demais gravações (fila, coordenador, versão, log). Nunca apaga registros criados depois do backup; `registros_semanais` (fórmula) não é restaurável. O botão "Redefinir Estrutura Padrão" (apagava o estado local) foi removido. Teste: `testBackup.ts` + navegador |

**Nova aba criada automaticamente na planilha:** `log_alteracoes` (colunas `log_id, ocorrido_em, usuario_declarado, tabela, registro_id, acao, campos, antes, depois, origem`). Só é acrescentada; nenhuma aba existente é alterada. O usuário é o e-mail informado pelo aplicativo (não verificado pelo servidor); verificação real depende da decisão D4 (papéis).

**Achado nos dados (cópia anonimizada):** a conferência do backup acusou 1 orientação apontando para uma matrícula inexistente. Registro órfão a revisar na planilha; não foi alterado.
