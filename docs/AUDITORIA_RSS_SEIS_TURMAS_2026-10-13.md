# Auditoria dos RSS — seis turmas (13/10/2026)

**Fonte**: leitura da planilha oficial de desenvolvimento, abas `registros_semanais`, `matriculas`, `turmas`, `grupos_pratica`, `grupo_integrantes`, `status_rss_unidades`. Nenhum registro acadêmico foi alterado.

| Turma | Matrículas | RSS | Sem semana RSS | Unidades sem RSS detalhado | Semanas válidas distintas | Duplicatas válidas na mesma semana |
|---|---:|---:|---:|---:|---:|---:|
| Clínica Adulto — Estágio 1 | 14 | 41 | 7 | 3 | 31 | 3 |
| Infantojuvenil — Estágio 2 | 11 | 41 | 3 | 1 | 33 | 4 |
| Clínica Ampliada — Matutino | 15 | 24 | 6 | 0 dos 5 grupos | 15 | 3 |
| Clínica Ampliada — Noturno | 21 | 39 | 9 | 0 dos 8 grupos | 23 | 7 |
| Saúde Mental no Trabalho — Estágio 2 | 6 | 3 | 0 | 4 | 2 | 1 |
| Consultoria Organizacional — Estágio 3 | 19 | 53 | 13 | 3 | 32 | 8 |
| **Total** | **86** | **201** | **38** | — | — | **26** |

**Como interpretar:** "sem semana" significa que o número `semana_rss` está vazio. Uma ocorrência assim pode conter conteúdo clínico útil e deve estar disponível para leitura, mas não é evidência de cumprimento de semana específica. "Duplicatas" são registros `RECEBIDO`, `VALIDADO`/`VALIDADO_ALIAS` adicionais para a mesma unidade e semana; manter ambos visíveis para orientar, mas contar apenas uma semana cumprida. "Unidades sem RSS detalhado" não comprovam ausência, pois existem consolidados e importações em revisão.

## Achados por turma
1. **Clínica Adulto — Estágio 1:** 41 formulários de 11 matrículas com registros detalhados; 3 matrículas sem RSS detalhado. Sete registros sem semana. Revisar divergências de três unidades entre consolidado `status_rss_unidades` e semanas distintas válidas; não inferir a qual semana pertencem.
2. **Infantojuvenil — Estágio 2:** 41 formulários; três sem semana. Uma matrícula não possui RSS detalhado. Há quatro repetições de semana válida e divergência consolidada em uma unidade.
3. **Clínica Ampliada — Matutino:** 24 RSS vinculados a cinco grupos. São registros compartilhados; uma mesma entrega não deve virar 2–3 registros individuais. Seis sem semana, três repetições de semana válida.
4. **Clínica Ampliada — Noturno:** 39 RSS de oito grupos; nove sem semana e sete repetições válidas; todos os oito grupos têm histórico.
5. **Saúde Mental no Trabalho — Estágio 2:** apenas três RSS detalhados entre seis matrículas. Não interpretar automaticamente os quatro sem registros detalhados como falta: verificar consolidados, início real da prática e prazo.
6. **Consultoria Organizacional — Estágio 3:** 53 RSS de 19 matrículas; 13 sem semana; três matrículas sem detalhe; oito repetições de semana válida.

## Regras de leitura
- Nunca substituir semana acadêmica por número da sessão/encontro.
- Exibir integralmente `objetivos`, `tecnicas_atividades`, `manejo_resposta`, `compreensao_atual`, `proximo_passo`, `prioridade_supervisao`, `duvidas_supervisao`, `limitacoes`.
- Separar `PENDENTE_REVISAO` de `VALIDADO`/`VALIDADO_ALIAS`; não gerar sanção por dado ambíguo.
- Na Clínica Ampliada, usar `grupo_id` e `turma_id`, jamais somar uma mesma entrega para cada integrante.
- A visualização em seis abas **RSS - ...** na própria planilha é derivada com `QUERY`; origem permanece a aba `registros_semanais` e as novas abas não devem ser editadas manualmente.

## Homologação pendente
Confirmar no aplicativo publicado pelo menos um RSS individual, um com semana vazia e um RSS grupal de **cada turma aplicável**; conferir o total de semanas distintas validadas versus consolidados. Em caso de divergência, sinalizar revisão em vez de presumir ausência ou concluir que a planilha está errada.
