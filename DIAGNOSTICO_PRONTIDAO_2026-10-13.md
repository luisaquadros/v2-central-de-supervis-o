# Diagnóstico após a segunda revisão — 13/10/2026

**Não liberado para uso exclusivo em supervisão.** Código corrigido e testes automatizados aprovados; publicação e homologação autenticada continuam bloqueantes. Este diagnóstico substitui a conclusão da auditoria anterior quanto ao estado atual do código.

## Problemas confirmados e corrigidos

- Inclusão no Sheets usava POST sem o sufixo obrigatório `:append`. O teste anterior aceitava qualquer endpoint `/values/`, ocultando a falha. Endpoint corrigido conforme a documentação oficial: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append.
- Instalação npm falhava com ERESOLVE: esbuild incompatível com Vite 8. Dependências alinhadas e instalação reproduzível por `npm ci`, com package-lock e CI usando Node 24. O lock Bun antigo foi substituído.
- Alterações pendentes antigas podiam sobrescrever edições recentes. Cache e fila agora são gravados na mesma transação IndexedDB, antes do envio. Alterações do mesmo registro são consolidadas, com operações serializadas e Web Locks entre abas quando disponíveis.
- Itens interrompidos em SINCRONIZANDO eram ignorados após reinício. Agora são retomados; remoção da fila ocorre apenas após resposta de sucesso.
- Orientações podiam ser confirmadas como salvas mesmo com falha no armazenamento local. Agora a falha é propagada, e o registro também entra no cache persistente.
- Chave de atualização dependia da posição das colunas e podia usar uma chave estrangeira. Agora há mapeamento explícito, bloqueio de chaves ausentes e duplicadas, e exclusão idempotente com resolução do nome real da aba.
- RSS editado e desfazer exclusão não persistiam no caminho web. Ambos foram ligados à fila resiliente.
- Tabelas realmente vazias mantinham registros antigos no cache e na interface. Leitura vazia confirmada agora é aplicada; resposta ausente é tratada como falha e preserva o cache.
- Avaliações completas e filas auxiliares sumiam após recarregar. Agora são persistidas localmente e incluídas no JSON exportado. A tela de avaliação informa explicitamente a limitação local. Isso NÃO equivale a sincronização remota dessas funcionalidades.
- Requisições ao Sheets têm limite de 20 segundos. Expiração do token em memória também é respeitada.
- Incluída proteção de erro na raiz da interface e restaurado zoom do navegador.

## Evidências de teste

- `npm ci`: instalação limpa.
- `npm run lint`: TypeScript sem erros.
- `npm test`: 63 verificações da auditoria existente, 18 operacionais, 10 grupos da API simulada e cenários adicionais usando o serviço real de sincronização com fake-indexeddb.
- Cenários adicionais: gravação local atômica, edição offline, recuperação de item interrompido, replay concorrente, proteção da edição mais recente e rejeição quando o armazenamento local falha.
- `npm run build`: bundle de produção gerado.
- Testes não utilizaram dados pessoais, credenciais reais nem escreveram na planilha institucional.

## Bloqueios verificados nesta sessão

1. **Cloudflare:** o Worker existente `v2-central-de-supervis-o` tem apenas deployment de template (`dash_template`) e não contém assets do app. A tentativa de enviar o bundle corrigido pela conexão disponível retornou `No access to the specified resource`. Não houve publicação das correções.
2. **Login/Sheets:** não foi possível homologar login Firebase, domínio autorizado, permissões da conta e gravação real. A base configurada continua sendo `Central de Supervisão - DESENVOLVIMENTO`; não foi substituída pela base de produção.
3. **Navegador:** teste visual/ponta a ponta não concluído. O runtime não possuía Chromium e a tentativa de instalação recebeu download inválido. A consulta pública ao endereço workers.dev também não permitiu abrir o app. Isso não comprova indisponibilidade global do domínio.

## Limitações que permanecem

- Avaliações completas, devolutivas e filas auxiliares são locais ao navegador; encontros/reagendamentos também continuam locais. Exportação JSON é cópia de segurança, não um fluxo de restauração homologado.
- Conflitos entre dispositivos independentes não têm controle de versão remoto transacional. Não editar o mesmo registro em dois dispositivos simultaneamente.
- Não houve comparação integral de todas as matrículas, grupos, rubricas e prazos com as fontes institucionais nesta sessão.
- As lacunas funcionais da auditoria anterior (reposições, fechamento, biblioteca e mensagens AVA) não foram implementadas nesta correção de estabilidade.

## Para liberar o uso

1. Publicar o commit corrigido no Worker existente usando uma conexão com permissão de edição/deploy. Build: `npm ci && npm run build`. Deploy: `npx wrangler@4 deploy`.
2. Autorizar o hostname publicado no Firebase Authentication, se ainda não estiver autorizado.
3. Entrar com a conta autorizada, conferir turma/lista e executar orientação, chamada e RSS de teste na base de desenvolvimento; recarregar e conferir diretamente no Sheets. Remover somente os testes.
4. Conferir fila vazia, ausência de erros e persistência após nova sessão; revisar a base de destino antes de usar dados reais.

**Orientação para a próxima supervisão:** manter a Central de Controle/planilha atual como registro principal até concluir esses passos. Não declarar o aplicativo funcionando perfeitamente com base apenas em compilação e testes simulados.
