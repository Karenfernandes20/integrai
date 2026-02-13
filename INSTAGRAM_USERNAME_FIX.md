# Correção do Sistema de Exibição de @username do Instagram

## 🎯 Problema Resolvido

O sistema estava exibindo o ID numérico do Instagram (ex: `811127842028737`) ou "Instagram User" ao invés do @username real do usuário.

## ✅ Solução Implementada

### 1. **Serviço de Busca de Perfil** (`instagramProfileService.ts`)
- Criado serviço dedicado para buscar perfis do Instagram via Graph API
- **Cache de 24h** para evitar excesso de chamadas à API
- Salva `instagram_id`, `instagram_username`, `instagram_name` e `instagram_updated_at`

### 2. **Banco de Dados**

#### Tabela `whatsapp_contacts`:
```sql
- instagram_id TEXT
- instagram_username TEXT  
- instagram_name TEXT
- instagram_updated_at TIMESTAMP
```

#### Tabela `whatsapp_conversations`:
```sql
- channel VARCHAR(50) DEFAULT 'whatsapp'
- instagram_user_id TEXT
- instagram_username TEXT
```

#### Tabela `whatsapp_messages`:
```sql
- channel VARCHAR(50) DEFAULT 'whatsapp'
```

### 3. **Lógica de Exibição**

No `getConversations`, a prioridade de exibição do nome agora é:

1. **Grupos**: `group_name`
2. **Instagram**: `@username` (do campo `instagram_username`)
3. **Instagram**: `instagram_name` (fallback)
4. **Contatos salvos**: `name` 
5. **WhatsApp**: `contact_name`
6. **WhatsApp**: `push_name`
7. **Fallback**: `phone` (ou "Instagram User" se for ID numérico do Instagram)

### 4. **Webhook do Instagram**

Atualizado para:
- Buscar perfil via `instagramProfileService` (com cache)
- Salvar username com `@` automaticamente
- Armazenar em `whatsapp_contacts` e `whatsapp_conversations`
- Nunca exibir ID numérico

## 🧠 Otimizações

### Cache Inteligente
```typescript
// Busca apenas se:
// 1. Username não existe no banco
// 2. OU última atualização > 24h

if (
  cached.instagram_username && 
  lastUpdate && 
  Date.now() - new Date(lastUpdate).getTime() < 24 * 60 * 60 * 1000
) {
  return cached; // Cache hit
}
```

### Formatação Automática
```typescript
// Sempre exibe com @
formatInstagramUsername(username) {
  if (/^\d+$/.test(username)) {
    return 'Instagram User'; // Nunca mostra ID
  }
  return username.startsWith('@') ? username : `@${username}`;
}
```

## 📋 Resultado Esperado

**Antes:**
```
811127842028737  ❌
Instagram User   ❌
```

**Depois:**
```
@username_real   ✅
@nome_usuario    ✅
```

## 🔐 Segurança

- Usa o mesmo `PAGE_ACCESS_TOKEN` já configurado
- Não cria nova variável de ambiente
- Cache reduz impacto na API do Facebook

## 🚀 Para Aplicar

1. Reiniciar o servidor (migrations rodam automaticamente)
2. As conversas existentes serão atualizadas na próxima mensagem
3. Cache de 24h garante performance

## 📝 Notas

- Se der erro 404 "instance does not exist" ao enviar mensagem, é outro problema (relacionado à Evolution API)
- O sistema NÃO busca retroativamente perfis antigos (apenas nas próximas mensagens)
- Para forçar atualização de perfis existentes, poderia criar um script de migração (não incluído)
