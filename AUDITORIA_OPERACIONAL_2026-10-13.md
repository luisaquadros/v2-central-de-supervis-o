# Auditoria operacional — Central de Supervisão 2026.2 (13/10/2026)

## Escopo e limitações

Repositório: `luisaquadros/v2-central-de-supervis-o`. Base transacional: planilha **Central de Supervisão - DESENVOLVIMENTO**, ID `1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4`. Fontes comparadas: **Central de Controle dos Estágios — 2026.2**; **[2.2026] Registro Semanal de Supervisão (respostas)**; **Base de Integração — Central de Supervisão — 2026.2**; base oficial e componentes do app.

Auditoria estática, inspeção de cabeçalhos reais e testes automatizados. **Não** foi executado teste de ponta a ponta autenticado com gravação real no Google Sheets, nem teste de acessibilidade/browser publicado. Não declarar operação comprovada sem essas verificações.

## Corrigido nesta branch

- Compilação TypeScript, imports de propriedades do contexto e suporte aos identificadores acadêmicos legados.
- Escrita em valores RAW, para impedir interpretação de observações como fórmula.
- Endereço inválido `A1:append` no método Sheets `values.append`, substituído por range A1 válido.
- Atualizações de registros preservam colunas que não constam da alteração, em vez de apagá-las.
- DELETE e UPDATE passam a executar efetivamente no Google Sheets. Exclusão remota exige chave primária única.
- Integração das operações de frequência, documentos, avaliação por critério, feedback, orientação, ocorrência, ponto de acompanhamento, registro de supervisão e entrega ao serviço de persistência.
- Fila local: alterações pendentes precisam ser confirmadas antes da leitura remota sobrepor cache.
- Mapeamento não destrutivo de aliases para as abas `entregas`, `registros_supervisao`, `feedbacks`, `leituras_responsaveis`, `grupo_integrantes`, `regras_rss`, `registros_semanais`.
- Data local da aula em vez de data UTC nas telas e lançamentos.
- Acesso às telas acadêmicas condicionado a login e validação da planilha; token do Google não é mais gravado persistentemente no `localStorage`.
- Testes simulados de escrita, atualização parcial, idempotência de frequência, exclusão e adaptação de cabeçalhos.

## Comparação funcional com os controles antigos

| Origem / rotina | Situação atual | Ação indicada |
| --- | --- | --- |
| Painel, alertas e prazos | Cobertura parcial no Hoje/Dashboard/Pendências | Testar contagens com turmas reais e distinguir não entregue x a conferir |
| Sala/Turma e Mapa de Supervisão | Modo Supervisão, turma, ficha, orientações e pontos | Verificar retorno entre fichas, registro longitudinal e reabertura de pendências |
| Registro mensal: frequência e conduta | Frequência, chamada, ocorrências | Validar gravação real e conferência posterior |
| Controle de RSS por semana e grupo | Calendário RSS, status RSS por unidade, registros | Verificar vínculo matrícula/grupo e faltas sem atendimento; não duplicar respostas importadas |
| Acompanhamento de notas | Nota por critério; avaliação completa em memória | **Lacuna relevante**: avaliação detalhada e devolutiva ainda não têm persistência remota consolidada |
| Feedbacks e histórico | Feedback e ocorrência individual; orientações com status | Revisar trilha histórica e evitar perda de evidências na exclusão |
| Artigos, bibliografia e responsáveis | Leituras responsáveis e contexto de aula | **Lacuna**: biblioteca de artigos/links por turma, controle de preparação |
| Mensagens AVA | Sem módulo próprio identificado | **Lacuna**: status do envio, data, link do material e histórico |
| Materiais e apoio | Sem acervo/linkoteca centralizada equivalente | **Lacuna**: atalhos por turma e fonte oficial |
| Reposições e carga horária | Frequência e justificativas, sem controle completo | **Lacuna importante**: horas, prazo, autorização, execução e validação |
| Fechamento do semestre | Documentos, notas e pendências dispersos | **Lacuna importante**: checklist individual/grupo de conclusão, devolutiva e revisão da nota |
| Registro do caderno e histórico | Ocorrência/feedback pontuais | **Lacuna**: importação conferível, fonte, status de validação e decisão |
| Fila da professora, caixa de entrada, encontros reagendados | Estados locais/memória ou `localStorage` | **Lacuna de persistência**: sincronização entre dispositivos não demonstrada |
| Avaliação Clínica Ampliada por pessoa e grupo | Há estrutura de avaliação, mas base contém escopos separados | Validar integração individual/grupo sem atribuir nota coletiva indevidamente |

**Não** criar tabelas novas nem migrar dados sensíveis automaticamente sem validar chaves/escopo e evitar duplicações. Preservar as planilhas de origem; usar a planilha de desenvolvimento como base para homologação.

## Checklist de homologação ao vivo (obrigatório antes de uso exclusivo)

1. Entrar no domínio publicado com conta Google autorizada. Confirmar nome correto de turma, listas completas de matrícula e período 2026.2.
2. Abrir Modo Supervisão; criar orientação de TESTE sem dados pessoais; conferir linha na aba `orientacoes`.
3. Atualizar a orientação; verificar que texto, categoria e chave não foram apagados. Excluir apenas o TESTE e conferir remoção.
4. Fazer chamada em turma de teste ou data claramente fictícia, conferindo gravação de `frequencias`. Repetir a chamada e confirmar que não duplicou por matrícula/data. Remover somente os testes em seguida.
5. Registrar feedback, documento e avaliação de TESTE; conferir linhas e edição; remover registros de teste.
6. Conferir indicadores de sincronização, data/hora de último envio e fila pendente. Bloquear uso exclusivo se houver status PARCIAL/ERRO.
7. Atualizar página e mudar de navegador/dispositivo; verificar que o que foi registrado remotamente permanece.
8. Confirmar Firebase Authentication: incluir o hostname da publicação entre os domínios autorizados; garantir que a conta Google tenha acesso à planilha.
9. Evitar colocar nomes e conteúdos identificáveis de pacientes/grupos na Central, em logs, mensagens ou backups. Permissões de compartilhamento da planilha devem permanecer restritas.
10. Fazer backup da base oficial antes da homologação; reservar a antiga Central de Controle para conferência enquanto persistências pendentes não forem resolvidas.

## Publicação planejada

Foi adicionado `wrangler.jsonc` para usar o Worker existente **v2-central-de-supervis-o** com recursos estáticos gerados por `npm run build`. Publicação depende de o Cloudflare conseguir conectar o repositório GitHub ou de um token de deploy autorizado. A conta consultada permite leitura, mas a tentativa de criar um projeto Pages via API retornou **erro de autenticação 10000**. Não houve confirmação de URL web ativo ou de deploy funcional.

No painel Cloudflare:
1. Workers & Pages > `v2-central-de-supervis-o` > Settings/Builds > conectar ao GitHub `luisaquadros/v2-central-de-supervis-o`.
2. Branch de produção: `main` após revisão/aprovação da PR.
3. Build command: `npm install && npm run build`.
4. Deploy command: `npx --yes wrangler@4 deploy`.
5. Root directory: `/`; conferir habilitação do domínio `workers.dev` **somente depois de obter deploy funcional**.
6. Em Firebase Authentication, autorizar o hostname usado pelo Cloudflare; validar login + leitura e escrita reais.

## Critério objetivo de prontidão

**Código compilável / testes de unidade:** aprovado no GitHub Actions após as correções (ver workflow `Verificacao de prontidao da supervisao`).  
**Integração real e autorização:** pendente de homologação em navegador.  
**Publicação no Cloudflare:** pendente de conexão/permissão de deploy.  
**Paridade total com planilhas de controle:** não alcançada; lacunas documentadas acima.

Para a supervisão imediata, manter a planilha antiga como contingência para reposições, fechamento, avaliações completas e operações que ainda dependem de dados locais.
