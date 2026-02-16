# Instagram Integration Checklist & Verification

- [x] Database Migration: `instagram_username` added to `contacts` table.
- [x] Webhook Logic: `handleInstagramWebhook` saves original username and respects manual name edits.
- [x] Backend Queries: `getConversations` and `getMessages` updated with Instagram-aware name priorities.
- [x] Frontend Display: `getDisplayName` correctly adds `@` prefix to Instagram usernames.
- [x] Contact Details: Instagram section with ID, Username and Direct Link (Open in Instagram).
- [x] CRM Sync: Renaming a contact in the chat now updates the `contacts` table correctly.

## Verification Steps
1. Receber uma mensagem de um novo usuário do Instagram.
2. Verificar se o card aparece com `@username`.
3. Renomear o contato no chat para "Test User".
4. Verificar se o card muda para "Test User".
5. Abrir os detalhes do contato e clicar em "Abrir no Instagram".
6. Simular uma nova mensagem do mesmo usuário e garantir que o nome "Test User" não é sobrescrito pelo username original.
