# Estado de execução

Atualizado: 13/10/2026 · Branch `fix/backend-persistencia-integridade` (PR #46)

**Objetivo atual:** E3 — chamada por exceção com `NAO_REGISTRADO` até o encerramento e prévia de presentes (D1).

## Concluído (ver `DOCUMENTO_MESTRE.md` §6)
E1 integridade/backup · E2 perfis e autorização no servidor · 18 tabelas coordenadas · documentos do Drive (UI + sincronização) · horário alternativo · `test:worker-real` no CI.

## Em andamento
E3 (ver "Próxima ação").

## Testes
Último ciclo completo: lint ✔ · `npm test` (30 arquivos) ✔ · build ✔ · `test:worker-real` ✔ (simulado). CI do commit `689d6ba` verde.

## Depende da usuária
- Validação real com cópia da planilha: `ADMIN_EMAILS`, conta de serviço, `ACESSOS_JSON`, conferir aba `monitoramento_documentos` e vínculos do Olyver (Configurações → Conferência).
- Decisões: D2 (regulamento de faltas/atrasos/reposição), D3 (pesos/rubricas), D5 (planilha canônica), D6, D7.
- Conferir o Apps Script antes de mesclar o PR (remove `gas/`).
- Ativar sincronização/crons somente após a validação real.

## Próxima ação exata
Implementar D1 na chamada (estado `NAO_REGISTRADO` enquanto aberta; prévia dos que serão presentes ao encerrar; confirmação explícita; sem presumir presença), sem tocar frequências já salvas. Em seguida: limpar cache local na troca de usuário; migrar as 9 tabelas de cadastro restantes (uma por vez).
