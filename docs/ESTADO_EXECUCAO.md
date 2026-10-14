# Estado de execução

Atualizado: 13/10/2026 · Branch `fix/backend-persistencia-integridade` (PR #46)

**Objetivo atual:** fechar E3 sem depender de D2/D3 e preparar a validação real.

## Concluído (detalhes em `DOCUMENTO_MESTRE.md` §6)
E1 · E2 (perfis, servidor) · 23 tabelas coordenadas · documentos do Drive + sincronização · horário alternativo · **E3-D1** (chamada NAO_REGISTRADO + prévia + confirmação) · cache limpo na troca de usuária · `test:worker-real` no CI.

## Testes (último ciclo)
lint ✔ · `npm test` (32 arquivos) ✔ · build ✔ · `test:worker-real` ✔ · navegador (simulado): prévia sem gravação prévia, clique duplo sem duplicar. Tudo **simulado**: nada validado com planilha/Google/Drive/Firebase reais.

## Depende da usuária
- Validação real em cópia da planilha (`ADMIN_EMAILS`, conta de serviço, `ACESSOS_JSON`; Configurações → Conferência: aba `monitoramento_documentos` e vínculos do Olyver).
- Conferir Apps Script antes de mesclar (PR remove `gas/`).
- D2, D3, D5, D6, D7. Ativar sincronização/crons só após a validação real.

## Próxima ação exata
1. **Precisa de autorização**: retificação de chamada encerrada (altera frequência já confirmada, ainda que com trilha).
2. ✔ Abas confidenciais da ficha ocultas para monitora (implementado; não exercitado no navegador com perfil monitora).
3. (Bloqueado por D2/D3/validação real) regras de falta/atraso, rubricas, ativação de crons.

## Engine de avaliação (nova)
- Implementada: `avaliacaoEngine.ts`, `avaliacaoAdaptador.ts`, quadro "Avaliação até o prazo" na aba Avaliação da ficha. Testes: `testAvaliacaoEngine`, `testQuadroAvaliacaoPrazo` (na cadeia de `npm test`). Detalhes em DOCUMENTO_MESTRE §4.1.
- Nenhum critério/subcritério/dado removido; nenhuma gravação nova; sem coluna nova na planilha.
- **Depende da professora (D3):** confirmar pesos e regras por turma, tipo de cada critério (`tipo_calculo`), `progressRatio` do prazo, total de registros por turma, e se o texto de feedback deve citar o quadro.
- Próximo (após D3): ligar configuração por turma, alimentar RSS/relatório no quadro e gerar o rascunho de devolutiva a partir dele.
