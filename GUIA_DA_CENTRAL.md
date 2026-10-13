# Central de Supervisão — guia rápido

App da professora supervisora de estágios de Psicologia. A **planilha Google é a base oficial**: o app lê e grava nela, e guarda uma cópia no aparelho para funcionar sem internet.

> Versão de 13/10/2026 (branch `feat/central-pratica-em-sala`). Substitui `AUDITORIA_OPERACIONAL_2026-10-13.md` e `DIAGNOSTICO_PRONTIDAO_2026-10-13.md`.

---

## 1. Como o app está organizado

| Tela | Para que serve | Quando usar |
|---|---|---|
| **Hoje** | Uma ação principal (aula agora / chamada que falta / próxima aula), as 5 pendências mais urgentes, lembretes e os próximos 7 dias | Ao abrir o app |
| **Turmas → turma** | Tudo da turma: Estudantes · Aulas e frequência · RSS · Leituras | Para olhar uma turma inteira |
| **Aula** (tela cheia) | Chamada por exceção, anotações por estudante, leitura do dia e fila de casos | Durante a supervisão |
| **Pendências** | Só o que pede ação sua, agrupado: chamadas, faltas, documentos, estudo dirigido e devolutivas | Fora da aula, para "zerar" a lista |
| **Estudantes → ficha** | Resumo, histórico, frequência, RSS, documentos e notas de uma pessoa | Para conversar com um estudante |
| **Avaliação** | Quadro de notas e devolutivas finais | Fechamento |
| **Calendário** | Semana com aulas, leituras e prazos | Planejamento |
| **Ajustes** | Conta, conferência da planilha, semestre e cópia de segurança | Raramente |

**Atalhos:** `N` abre *Anotar* (texto livre: "Ana mandou atestado da falta de ontem" vira justificativa de falta da Ana, com a data de ontem) · `Ctrl+K` abre a busca.

---

## 2. O que mudou

### Na rotina
- **Pendências só com o que é acionável.** RSS atrasado ou não enviado **saiu das pendências**: aparece só na aba **RSS de cada turma**, numa lista única ordenada pelo que falta, com filtros *Todos / Atrasados / Sem envio na semana*.
- **Cada pendência tem o botão que a resolve ali mesmo** (fazer chamada, "Já fiz no Docente", "Não houve aula", aceitar/recusar justificativa, conferir documentos, registrar estudo dirigido, abrir devolutiva).
- **Chamada por exceção:** todos começam presentes; marca-se só falta, atraso ou celular. O rascunho fica salvo se a página fechar.
- **Alertas com significado:** o ponto colorido ao lado do nome reflete faltas, justificativas, documentos e pontos de acompanhamento. O RSS não acende alerta, porque costuma atrasar para a turma toda.
- **Aulas antigas não viram alarme:** só as aulas dos últimos 14 dias aparecem como "Chamada pendente". As anteriores aparecem como "Sem chamada no app", em tom neutro.
- **Preparar aula:** resumo de 2 minutos (leitura do dia, quem precisa de atenção, orientações em aberto, fila de casos).
- **Exclusão segura:** confirma antes e permite *Desfazer* por 10 segundos.

### Na ligação com a planilha (as "conexões desligadas")
- Leituras e estudo dirigido, encontros cancelados ou reagendados, feedbacks antigos (`feedback_alunos`), documentos (`entregas`), lembretes e preparações passaram a ser lidos **e** gravados.
- O nome do semestre ("2026.2") deixou de ser lido como data.
- Gravação **célula a célula**: o app só escreve nas colunas que mudou e nunca apaga fórmulas.
- Abas geradas por fórmula ficam **somente leitura**: `registros_semanais`, `marcos_academicos`, `status_rss_unidades`, `situacao_atual_turmas`.
- Fila no aparelho: se a internet cair, o que foi salvo é enviado depois, na ordem certa e sem duplicar.
- **Números vão como números** (notas, totais de presença, dia da semana), para que fórmulas e somas da planilha funcionem.
- **Data e hora locais.** O carimbo era gerado em UTC: um registro feito às 22h de 13/10 ficava como 14/10. Agora segue a hora de Brasília, e os carimbos antigos em UTC são exibidos na hora local.
- **Datas escritas à mão** nas importações ("29/09 e 05/10/2026", "Set/2026", "Início do semestre") são ordenadas pela data reconhecível e aparecem com o texto original.

### No código
- Saíram telas, componentes e serviços sem uso (assistente com IA, sino de notificações, caixas de entrada duplicadas, Modo Aula antigo, scripts do Apps Script, dados de exemplo) e as dependências ligadas a eles (`@google/genai`, `express`, `dotenv`, `motion`).
- Um único registro das abas (`src/services/tabelas.ts`) define o que é lido, o que pode ser gravado e quais colunas o app pode criar.

---

## 3. O que a planilha recebe automaticamente

Nada é apagado. O app só **acrescenta**:

| Onde | O que entra | Quando |
|---|---|---|
| Aba nova `tarefas_professora` | Lembretes da professora | No primeiro lembrete criado |
| `frequencias` | Colunas `atraso`, `celular`, `observacao` | Na primeira chamada salva |
| `encontros_turma` | Colunas `hora_inicio`, `hora_fim`, `data_original`, `data_reagendada`, `hora_reagendada`, `chamada_salva`, `total_presentes`, `total_faltas` | Ao salvar chamada, cancelar ou reagendar aula |
| `matriculas` | Coluna `origem_id` | Ao indicar a turma de origem de um estudante |
| `horarios_turma` | Dia como **número** (1 = segunda … 5 = sexta) e o nome em `dia_semana_rotulo` | Ao editar o horário de uma turma (mantém a correção C1 e o controle AUD-038) |

As colunas novas vão sempre **para o fim do cabeçalho**, sem mexer nas existentes.

---

## 4. O que foi verificado

Com uma cópia dos dados reais (nomes trocados por "Estudante N"):

- ✅ Horários, turmas e semestre lidos corretamente.
- ✅ Aula em andamento detectada no horário certo; aulas canceladas não geram chamada pendente.
- ✅ RSS do app bate com a aba `situacao_atual_turmas` nas 6 turmas.
- ✅ 50 de 53 responsáveis de leitura ligados aos estudantes (os 3 restantes têm nome diferente na planilha).
- ✅ Situação dos documentos: 115 entregues, 128 a conferir, 6 pendentes, 9 não se aplicam.
- ✅ Teste no navegador: chamada de 14 estudantes gravou 14 linhas novas em `frequencias`, 1 ocorrência de atraso e o encontro como realizado.
- ✅ Planilha atualizada em 13/10 (correção C1 + importações do caderno): dias numéricos lidos corretamente; às 10h de 13/10 o app reconhece a aula da T1 em andamento.
- ✅ 138 feedbacks importados com a data real (setembro e outubro, nenhum preso no dia da importação); 9 registros sobre a turma inteira aparecem na página da turma; 36 marcados "NAO_AUTOMATICO" ficam na ficha e fora da devolutiva.
- ✅ 38 RSS com `PENDENTE_REVISAO` não contam como entregues e aparecem como "em revisão" em cada turma.
- ✅ `npm run lint`, `npm test` (3 suítes, também no fuso de Brasília) e `npm run build` sem erros.

### Problemas da auditoria da planilha × esta versão

| Problema apontado | Situação nesta versão |
|---|---|
| Chamadas na data errada | Corrigido: datas e horas locais; a chamada usa a data da aula aberta, não a do relógio |
| Ocorrências duplicadas | Corrigido: atraso e celular da chamada têm identificador fixo (estudante + data); salvar de novo atualiza, não duplica |
| Alterações que somem após sincronizar | Corrigido: enquanto há envio pendente, a cópia local não é sobrescrita (teste automático de fila) |
| Devolutiva que "simula" envio | Corrigido: o app abre o Gmail com o texto pronto; só fica "enviada" quando você confirma |
| Exclusões sem confirmação | Corrigido: toda exclusão pede confirmação e permite Desfazer por 10 s |
| Indicadores divergentes entre telas | Corrigido: uma única fonte de pendências e de RSS para todas as telas |
| 38 registros semanais pendentes de revisão | Mantidos como estão (decisão sua); aparecem como "em revisão" e não contam como entregues |

---

## 5. Antes de usar com a turma (homologação)

1. **Firebase:** em *Authentication → Settings → Authorized domains*, incluir o endereço onde o app estiver publicado.
2. **Cópia de segurança:** em *Ajustes*, baixar a cópia; no Google, fazer uma cópia da planilha.
3. **Entrar** com a conta Google que tem acesso à planilha. Em *Ajustes → Conferência da planilha*, confirmar que não há problemas listados.
4. **Teste de gravação:** criar uma orientação "TESTE" e conferir a linha na aba `orientacoes`. Excluir em seguida.
5. **Chamada de teste:** usar uma data de aula já passada; conferir `frequencias`; salvar de novo e confirmar que **não duplica**. Depois, apagar essas linhas de teste direto na planilha.
6. **Recarregar** a página e abrir em outro aparelho: o que foi gravado deve continuar lá.
7. O selo do topo deve mostrar **"Tudo salvo"**. Se mostrar erro, não usar como registro único até resolver.

**Cuidado com dados sensíveis:** não registrar nomes ou detalhes identificáveis de pacientes na Central; manter o compartilhamento da planilha restrito.

---

## 6. Publicação (Cloudflare)

O `wrangler.jsonc` publica a pasta `dist` no Worker `v2-central-de-supervis-o`.

1. *Workers & Pages → v2-central-de-supervis-o → Settings → Builds*: conectar ao GitHub `luisaquadros/v2-central-de-supervis-o`, branch `main`.
2. Build: `npm ci && npm run build` · Deploy: `npx --yes wrangler@4 deploy` · Pasta raiz: `/`.
3. Autorizar o endereço publicado no Firebase (passo 1 da seção 5).

---

## 7. Limitações conhecidas

- **Login real ainda não testado** neste ambiente (sem acesso à conta Google). O teste usou uma planilha simulada com os dados reais anonimizados.
- **O acesso do Google expira em cerca de 55 minutos.** O que for salvo depois disso espera na fila do aparelho; o app avisa e pede para reconectar com 1 toque, e então envia tudo. Nada se perde.
- **A frequência oficial continua no Docente Online.** O app registra a chamada para acompanhamento; o botão "Já fiz no Docente" marca a aula como resolvida sem lançar presença.
- 3 responsáveis de leitura não foram ligados a estudantes por diferença de nome; aparecem com o nome da planilha.
- As abas `fonte_controle_ao_vivo`, `fonte_rss_ao_vivo` e `importacao_pendente` (espelhos e fila de importação) não são lidas pelo app.

---

## 8. Para quem mantém o código

```bash
npm ci          # instalar
npm run dev     # desenvolver (porta 3000)
npm run lint    # checagem de tipos
npm test        # leitura/gravação na planilha, fila offline e regras de operação
npm run build   # gera dist/index.html (arquivo único)
```

| Arquivo | Papel |
|---|---|
| `src/services/tabelas.ts` | Registro das abas: leitura, gravação, colunas permitidas e chaves |
| `src/services/googleSheetsService.ts` | Leitura em lote e gravação célula a célula |
| `src/services/normalizacaoPlanilha.ts` | Converte datas, horas, dias e nomes de colunas da planilha |
| `src/services/syncService.ts` + `indexedDbService.ts` | Cópia local e fila de envio |
| `src/services/supervisaoOperacionalService.ts` | Regras: agenda, feriados, chamadas pendentes, RSS, pendências |
| `src/context/SupervisaoContext.tsx` | Estado do app e todas as ações |
| `src/context/NavegacaoContext.tsx` | Navegação com botão Voltar |
| `src/components/ui.tsx` | Botões, cartões, selos e janelas |
