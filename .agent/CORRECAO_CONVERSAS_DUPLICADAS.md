# Correção de Bugs nas Conversas

## Data: 2026-01-07

## Problemas Identificados

### 1. **Conversas Duplicadas no Frontend**
- **Causa**: Quando uma nova mensagem chegava pelo socket, o código removia a conversa antiga da lista e adicionava a atualizada no topo, mas não havia verificação consistente para evitar duplicatas.
- **Impacto**: Conversas apareciam múltiplas vezes na lista de atendimento.

### 2. **Conversas Não Ficando no Lugar Correto**
- **Causa**: A ordenação das conversas não estava sendo aplicada de forma consistente em todos os locais onde a lista era modificada.
- **Impacto**: Conversas com mensagens mais recentes não necessariamente apareciam no topo da lista.

## Soluções Implementadas

### Abordagem Geral
Implementamos uma estratégia de **deduplicação baseada em Map** combinada com **ordenação consistente** em todos os pontos onde a lista de conversas é modificada.

### Mudanças Específicas

#### 1. **Socket Handler - Recebimento de Mensagens** (linhas ~763-820)
**Antes:**
```typescript
setConversations((prev) => {
  // ... lógica de atualização ...
  updatedList.splice(existingIndex, 1); // Remove antiga
  updatedList.unshift(conversationToUpdate); // Adiciona no topo
  return updatedList; // SEM ordenação ou deduplicação
});
```

**Depois:**
```typescript
setConversations((prev) => {
  // ... lógica de atualização ...
  
  // Create a Map to prevent duplicates
  const conversationMap = new Map<string | number, Conversation>();
  
  // Add all existing conversations except the one we're updating
  prev.forEach(c => {
    if (existingIndex >= 0 && String(c.id) === String(prev[existingIndex].id)) {
      return; // Skip old version
    }
    conversationMap.set(String(c.id), c);
  });
  
  // Add the updated conversation
  conversationMap.set(String(conversationToUpdate.id), conversationToUpdate);
  
  // Convert back to array and sort by most recent message
  return Array.from(conversationMap.values()).sort(
    (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
  );
});
```

#### 2. **Envio de Mensagens** (linhas ~1614-1641)
**Antes:**
```typescript
setConversations(prev => {
  return prev.map(c => {
    // ... atualizar conversa ...
  }).sort(...); // Tinha ordenação MAS sem deduplicação
});
```

**Depois:**
```typescript
setConversations(prev => {
  const updated = prev.map(c => {
    // ... atualizar conversa ...
  });
  
  // Create a Map to prevent duplicates
  const conversationMap = new Map<string | number, Conversation>();
  updated.forEach(c => {
    conversationMap.set(String(c.id), c);
  });
  
  // Convert back to array and sort
  return Array.from(conversationMap.values()).sort(
    (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
  );
});
```

#### 3. **Criação de Conversa Temporária (URL Params)** (linhas ~547-557)
**Antes:**
```typescript
setConversations(prev => [newConv, ...prev]); // Adiciona sem verificar duplicatas
```

**Depois:**
```typescript
setConversations(prev => {
  const conversationMap = new Map<string | number, Conversation>();
  prev.forEach(c => conversationMap.set(String(c.id), c));
  conversationMap.set(String(newConv.id), newConv);
  return Array.from(conversationMap.values()).sort(
    (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
  );
});
```

#### 4. **Iniciar Conversa de um Contato** (linhas ~1423-1432)
**Antes:**
```typescript
setConversations(prev => [newConversation, ...prev]); // Adiciona sem verificar duplicatas
```

**Depois:**
```typescript
setConversations(prev => {
  const conversationMap = new Map<string | number, Conversation>();
  prev.forEach(c => conversationMap.set(String(c.id), c));
  conversationMap.set(String(newConversation.id), newConversation);
  return Array.from(conversationMap.values()).sort(
    (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
  );
});
```

## Benefícios

✅ **Eliminação total de duplicatas**: O uso de `Map` com chave baseada em `String(c.id)` garante que cada conversa apareça apenas uma vez.

✅ **Ordenação consistente**: Todas as conversas são sempre ordenadas por `last_message_at` em ordem decrescente (mais recente primeiro).

✅ **Previsibilidade**: O comportamento é consistente em todos os pontos de modificação da lista.

✅ **Performance**: Map operations são O(1) para inserção e busca, mantendo a performance mesmo com muitas conversas.

## Testes Recomendados

1. **Receber mensagem nova** → Verificar se a conversa sobe para o topo sem duplicar
2. **Enviar mensagem** → Verificar se a conversa do remetente sobe para o topo
3. **Abrir conversa de URL** → Verificar se não cria duplicata se já existir
4. **Iniciar conversa de contato** → Verificar se não cria duplicata se já existir
5. **Múltiplas mensagens simultâneas** → Verificar se não há condições de corrida criando duplicatas

## Arquivos Modificados

- `client/src/pages/Atendimento.tsx` - 4 modificações em pontos críticos

## Notas Técnicas

- Usamos `String(c.id)` para garantir comparação consistente entre IDs numéricos e strings (importante para conversas temporárias que usam string IDs como `'temp-1234567890'`)
- A ordenação é feita APÓS a deduplicação para garantir que estamos sempre ordenando a lista final limpa
- Mantivemos toda a lógica de negócio existente (unread_count, status, etc.) intacta
