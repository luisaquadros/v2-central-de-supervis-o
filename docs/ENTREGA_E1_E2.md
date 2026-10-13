# Entrega E1 (conclusão) e E2 (início) — 13/10/2026

Base: PRD v1.1 + Adendo v1.2 + decisões D1–D7 do pedido de 13/10. Branch `fix/backend-persistencia-integridade` (PR #46).

## 1. Ação obrigatória antes de publicar
**Defina `ADMIN_EMAILS` no Worker (Cloudflare → Workers → Settings → Variables).** Lista de e-mails separados por vírgula (a professora administradora). **Sem essa variável nenhuma gravação é aceita** (falha fechada, conforme D4); o app mostra o motivo em Configurações → "Acesso de gravação" e deixa as alterações pendentes (nunca como salvas). Leitura continua dependendo do compartilhamento Google da planilha.

## 2. O que foi implementado

| Item | Estado | Onde |
|---|---|---|
| Autorização no servidor | ✅ | `src/server/autorizacao.ts`, `worker.ts`: token de ID do Firebase verificado no Worker (assinatura RS256 com chaves públicas do Google, emissor, público, validade, e-mail verificado) + lista `ADMIN_EMAILS`. O e-mail enviado no corpo é ignorado. Chaves em cache de 1 h, com nova busca (máx. 1/min) se aparecer `kid` desconhecido (rotação) |
| Log de autoria com identidade verificada | ✅ | aba `log_alteracoes` (`usuario_verificado`); texto livre nunca vai ao log |
| Escritas versionadas e idempotentes | 🟡 | 14 tabelas passam pelo coordenador (CAS + `operacaoId`). **Faltam** as de cadastro: alunos, matrículas, turmas, horários, períodos, disciplinas, configurações, marcos, critérios, grupos |
| `/api/acesso` + painel "Acesso de gravação" | ✅ | Configurações |
| Backup v2.0 (checksum) + conferência + restauração por registro | ✅ | `backupService.ts`, `BackupPainel.tsx` |
| Falso "salvo" | ✅ | recusa do servidor (401/403/503) deixa o item pendente (`ERRO`) e `gravadoOnline=false` |
| Defeito corrigido: Worker não iniciava | ✅ | O PR exportava `LIMITE_CORPO`/funções de `worker.ts`; o runtime real recusa qualquer export que não seja handler/classe de Durable Object. Auxiliares movidos para `utilitariosWorker.ts`; teste impede reincidência. **O CI anterior (build + `--dry-run`) não detectava isso** |

## 3. Como foi testado

| Teste | Prova |
|---|---|
| `npm run lint` / `npm test` (27 arquivos) / `npm run build` | tipos, regras, CAS, auditoria, backup, autorização |
| `testAutorizacao` | token expirado, público/emissor errados, outra chave, `alg:none`, payload adulterado, e-mail não verificado, rotação de chaves, falha fechada sem lista, identidade do corpo ignorada, Origin estranha, só exports permitidos |
| `testE1Integracao` | tela → fila → Worker (handler real) → coordenador → planilha simulada; conta fora da lista fica pendente e a planilha intacta |
| **`npm run test:worker-real`** (novo, também no CI) | **Worker real em workerd** (`wrangler dev --local`) + planilha simulada e JWKS em loopback: sem identidade 401; conta fora da lista 403 sem gravar; administradora 200 com 1 linha de log com o e-mail verificado e sem texto livre; reenvio idêntico `replayed`; versão antiga 409; duas gravações simultâneas 200+409; corpo > 128 KB 413; estáticos 200 |
| Navegador (planilha simulada) | backup: baixar, conferir íntegro, recusar adulterado, restaurar 1 registro |

**O que isto NÃO prova:** nada foi executado contra a planilha oficial, contra o Google real nem contra um Firebase real. Faltam, em ambiente seguro: (a) fazer uma **cópia** da planilha oficial no Drive; (b) apontar um deploy de preview para ela; (c) repetir os cenários acima com a conta da professora. Não fiz isso: exige gravar em planilha com dados reais e conta Google que esta sessão não tem.

## 4. Apps Script — verificação antes de remover
- **Repositório:** nenhuma referência restante (`google.script`, `clasp`, `doGet/doPost`, URLs `script.google.com`) em código, CI, `wrangler.jsonc`, `vite.config`, `index.html`. A remoção está **apenas no PR #46**; `main` ainda tem `gas/` (reversível: não mesclar, ou `git revert 59ea391`).
- **Google Drive da conta:** existe 1 projeto de script independente, "Projeto sem título", criado em 03/10/2026. Não foi possível inspecionar implantações nem gatilhos por aqui. Scripts **vinculados** à planilha (Extensões → Apps Script) não aparecem na busca do Drive.
- **Você precisa conferir antes de mesclar** (script.google.com → projeto → menus à esquerda): *Gatilhos* (nenhum ativo?), *Implantações* (nenhum app da web em uso?), *Execuções* (nada recente?). Faça o mesmo em *Extensões → Apps Script* dentro da planilha oficial. Se algo estiver em uso, **não mescle** e me avise: restauro `gas/`.
- Os arquivos removidos continuam no histórico do git.

## 5. Restauração de backup — estado
Testada em planilha **simulada isolada** (ver `testBackup`). Não é possível restaurar em massa nem apagar registros novos. Procedimento recomendado em produção: (1) baixar backup; (2) em "Conferir um backup", revisar as diferenças; (3) restaurar registro a registro. Para um teste real com cópia, ver §3.

## 6. Plano de reversão
| Mudança | Como reverter |
|---|---|
| Autorização no servidor | remover `ADMIN_EMAILS` não reabre acesso (falha fechada). Para voltar ao comportamento anterior: `git revert` dos commits E2 |
| Log | apagar a aba `log_alteracoes` (nenhuma outra aba depende dela) |
| 14 tabelas no coordenador | remover nomes de `TABELAS_CRITICAS` (`coordenacaoCritica.ts`); voltam ao caminho direto |
| Apps Script | `git revert 59ea391` |
| Restauração | cada registro restaurado tem linha no log com antes/depois |

## 7. Pendências e bloqueios
- **D2** (falta/atraso/justificativa/dispensa) e **D3** (pesos): não implementar notas nem regras de falta; nenhuma nota oficial foi alterada, nenhum registro histórico apagado.
- **D5** (planilha canônica): nenhuma migração feita; `monitoramento_documentos` só depois.
- **D6/D7**: política offline é "fila ≠ salvo"; retenção não definida.
- E2 restante: leitura ainda depende do compartilhamento Google (para bloquear leitura no servidor seria preciso passar as leituras pelo Worker); papéis além da administradora (monitoras) não existem por D4.
- Migrar as 10 tabelas de cadastro para o coordenador.
- E3 em diante (chamada com `NAO_REGISTRADO` até encerrar, diário, marcos, RSS/metadados, rubricas, competências).
