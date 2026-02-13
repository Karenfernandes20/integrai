# 🎯 PLANO DE IMPLEMENTAÇÃO: CONFIGURAÇÕES DO SISTEMA

## 📋 Visão Geral

Implementar um sistema completo de distribuição automática de atendimentos, configurações avançadas de chatbot e gerenciamento de filas.

---

## 🗄️ FASE 1: ESTRUTURA DE BANCO DE DADOS

### Tabelas a Criar/Modificar

#### 1. `system_settings` (Nova)
```sql
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Distribuição
    auto_distribution BOOLEAN DEFAULT false,
    distribution_type VARCHAR(50) DEFAULT 'round_robin', -- round_robin, priority, department, manual
    max_active_chats INTEGER DEFAULT 5,
    reassign_timeout INTEGER DEFAULT 10, -- minutos
    skip_offline_users BOOLEAN DEFAULT true,
    
    -- Fila
    enable_queue BOOLEAN DEFAULT false,
    queue_max_size INTEGER DEFAULT 50,
    queue_message TEXT,
    
    -- SLA
    response_sla INTEGER, -- minutos
    resolution_sla INTEGER, -- horas
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(company_id)
);
```

#### 2. `distribution_users` (Nova)
```sql
CREATE TABLE distribution_users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1, -- 1 = alta, 2 = normal, 3 = baixa
    max_concurrent INTEGER DEFAULT 5,
    department VARCHAR(100),
    last_assigned_at TIMESTAMP,
    total_assigned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(company_id, user_id)
);
```

#### 3. `chatbot_settings` (Nova)
```sql
CREATE TABLE chatbot_settings (
    id SERIAL PRIMARY KEY,
    chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
    
    -- Retentativas
    retry_limit INTEGER DEFAULT 2,
    retry_timeout INTEGER DEFAULT 5, -- minutos
    retry_message TEXT,
    
    -- Transferência
    transfer_after_retry BOOLEAN DEFAULT true,
    transfer_keywords TEXT[], -- ex: ['atendente', 'humano', 'pessoa']
    transfer_to_user_id INTEGER REFERENCES users(id),
    transfer_to_department VARCHAR(100),
    
    -- Distribuição
    auto_distribute_after_flow BOOLEAN DEFAULT false,
    
    -- Horário
    business_hours_start TIME,
    business_hours_end TIME,
    business_days INTEGER[], -- 0-6 (domingo a sábado)
    off_hours_message TEXT,
    
    -- Prioridade
    default_priority VARCHAR(20) DEFAULT 'normal', -- high, normal, low
    vip_tag VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(chatbot_id)
);
```

#### 4. `conversation_assignments` (Nova)
```sql
CREATE TABLE conversation_assignments (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    assignment_type VARCHAR(50), -- auto, manual, transfer
    reason TEXT,
    
    -- Tracking
    first_response_at TIMESTAMP,
    closed_at TIMESTAMP,
    response_time INTEGER, -- segundos
    resolution_time INTEGER, -- segundos
    
    UNIQUE(conversation_id)
);
```

#### 5. Modificar `whatsapp_conversations`
```sql
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER REFERENCES users(id);
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS queue_position INTEGER;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS department VARCHAR(100);
```

#### 6. `chatbot_retry_log` (Nova - Tracking)
```sql
CREATE TABLE chatbot_retry_log (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES whatsapp_conversations(id),
    chatbot_id INTEGER REFERENCES chatbots(id),
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP DEFAULT NOW(),
    transferred BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔧 FASE 2: BACKEND - CONTROLLERS

### Controllers a Criar

#### 1. `systemSettingsController.ts`
```typescript
// GET /api/system-settings
export async function getSystemSettings(req, res)

// PUT /api/system-settings
export async function updateSystemSettings(req, res)

// GET /api/system-settings/distribution-users
export async function getDistributionUsers(req, res)

// PUT /api/system-settings/distribution-users/:userId
export async function updateDistributionUser(req, res)

// POST /api/system-settings/test-distribution
export async function testDistribution(req, res)
```

#### 2. `distributionService.ts`
```typescript
// Lógica principal de distribuição
export async function distributeConversation(conversationId, companyId)

// Round Robin
async function roundRobinDistribution()

// Por Prioridade
async function priorityDistribution()

// Por Departamento
async function departmentDistribution()

// Verificar disponibilidade
async function getAvailableUsers(companyId)

// Verificar limites
async function checkUserLimit(userId)

// Atualizar fila
async function updateQueue()
```

#### 3. `chatbotSettingsController.ts`
```typescript
// GET /api/chatbot-settings/:chatbotId
export async function getChatbotSettings(req, res)

// PUT /api/chatbot-settings/:chatbotId
export async function updateChatbotSettings(req, res)

// POST /api/chatbot-settings/:chatbotId/test-transfer
export async function testTransfer(req, res)
```

#### 4. Modificar `webhookController.ts`
```typescript
// Adicionar no fluxo de webhook:
- Verificar retry do chatbot
- Auto-transferir se necessário
- Verificar palavras-chave
- Distribuir automaticamente
```

---

## 🎨 FASE 3: FRONTEND - COMPONENTES

### Páginas a Criar

#### 1. `SystemSettings.tsx` (Principal)
```
📁 client/src/pages/configuracoes/
    └── SystemSettings.tsx
```

**Seções:**
- Distribuição de Atendimentos
- Limite de Atendimentos
- Reatribuição Automática
- Fila de Espera
- SLA

#### 2. `DistributionUsers.tsx` (Componente)
```
📁 client/src/components/system-settings/
    └── DistributionUsers.tsx
```

**Features:**
- Lista de usuários
- Checkbox para ativar/desativar
- Prioridade
- Limite individual
- Departamento

#### 3. `ChatbotSettings.tsx` (Dentro de cada bot)
```
📁 client/src/components/chatbot/
    └── ChatbotSettingsTab.tsx
```

**Abas:**
- Retentativas
- Transferência
- Horário de Funcionamento
- Prioridade

#### 4. `QueueDashboard.tsx` (Dashboard de Fila)
```
📁 client/src/components/system-settings/
    └── QueueDashboard.tsx
```

**Exibir:**
- Conversas em fila
- Posição na fila
- Tempo de espera
- Atribuições recentes

---

## 🚀 FASE 4: LÓGICA DE DISTRIBUIÇÃO

### Fluxo Principal

```typescript
1. Nova mensagem chega (webhook)
   ↓
2. Verificar se conversa já tem atendente
   ↓
3. Se não tem:
   - Verificar configuração de auto-distribuição
   - Se ativo: chamar distributionService
   ↓
4. distributionService:
   - Buscar usuários ativos
   - Verificar tipo de distribuição
   - Aplicar round robin / prioridade / departamento
   - Verificar limite de cada usuário
   - Atribuir conversa
   - Salvar em conversation_assignments
   - Atualizar whatsapp_conversations.assigned_user_id
   ↓
5. Notificar usuário atribuído (WebSocket)
```

### Round Robin Logic

```typescript
async function roundRobinDistribution(companyId: number) {
  // 1. Buscar usuários ativos e ordenados
  const users = await pool.query(`
    SELECT u.id, u.full_name, du.last_assigned_at, du.total_assigned
    FROM distribution_users du
    JOIN users u ON u.id = du.user_id
    WHERE du.company_id = $1 AND du.is_active = true
    ORDER BY du.last_assigned_at ASC NULLS FIRST, du.total_assigned ASC
  `, [companyId]);

  // 2. Para cada usuário, verificar limite
  for (const user of users.rows) {
    const activeChats = await getActiveChatsCount(user.id);
    const limit = await getUserLimit(user.id);
    
    if (activeChats < limit) {
      return user.id; // Retornar este usuário
    }
  }

  // 3. Se todos no limite, colocar em fila
  return null;
}
```

---

## 📊 FASE 5: ROTAS E INTEGRAÇÕES

### Novas Rotas

```typescript
// System Settings
router.get('/system-settings', authenticateToken, getSystemSettings);
router.put('/system-settings', authenticateToken, updateSystemSettings);
router.get('/system-settings/distribution-users', authenticateToken, getDistributionUsers);
router.put('/system-settings/distribution-users/:userId', authenticateToken, updateDistributionUser);

// Chatbot Settings
router.get('/chatbot-settings/:chatbotId', authenticateToken, getChatbotSettings);
router.put('/chatbot-settings/:chatbotId', authenticateToken, updateChatbotSettings);

// Assignments
router.get('/assignments', authenticateToken, getAssignments);
router.post('/assignments/:conversationId/reassign', authenticateToken, reassignConversation);

// Queue
router.get('/queue', authenticateToken, getQueue);
```

---

## 🔄 FASE 6: TEMPO REAL (WebSocket)

### Eventos a Implementar

```typescript
// Notificar atribuição
socket.emit('conversation:assigned', {
  conversationId,
  userId,
  priority
});

// Notificar fila atualizada
socket.emit('queue:updated', {
  position,
  waitTime
});

// Notificar reatribuição
socket.emit('conversation:reassigned', {
  conversationId,
  fromUserId,
  toUserId,
  reason
});
```

---

## 📈 FASE 7: MELHORIAS EXTRAS

- [ ] Dashboard de performance por atendente
- [ ] Relatório de SLA
- [ ] Métricas de tempo médio de resposta
- [ ] Tags automáticas por setor
- [ ] Resposta automática se fila cheia
- [ ] Chatbot de fila de espera
- [ ] Notificações push para atendentes
- [ ] Histórico de atribuições
- [ ] Audit log de mudanças

---

## 🎯 PRIORIZAÇÃO DE IMPLEMENTAÇÃO

### Sprint 1 (Fundamental)
1. ✅ Criar migrações de banco
2. ✅ Criar página de Configurações do Sistema
3. ✅ Implementar distribuição Round Robin básica
4. ✅ Salvar usuários participantes

### Sprint 2 (Core)
1. ✅ Lógica de verificação de limite
2. ✅ Auto-atribuição ao receber mensagem
3. ✅ Atualizar UI em tempo real
4. ✅ Configurações de chatbot básicas

### Sprint 3 (Avançado)
1. ✅ Sistema de fila
2. ✅ Reatribuição automática
3. ✅ Chatbot retry logic
4. ✅ Transferência automática

### Sprint 4 (Extra)
1. ✅ Dashboard de métricas
2. ✅ SLA tracking
3. ✅ Relatórios
4. ✅ Notificações avançadas

---

## 🚨 PONTOS DE ATENÇÃO

1. **Performance**: Distribuição deve ser rápida (< 100ms)
2. **Concorrência**: Evitar race conditions na atribuição
3. **Múltiplas instâncias**: Garantir que funcione com várias instâncias WhatsApp
4. **Retrocompatibilidade**: Não quebrar chats existentes
5. **Testes**: Testar com múltiplos usuários simultâneos

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [ ] Distribuição Round Robin funciona
- [ ] Limite de atendimentos é respeitado
- [ ] Offline users são pulados
- [ ] Reatribuição automática funciona
- [ ] Chatbot retry funciona
- [ ] Transferência automática funciona
- [ ] Fila exibe corretamente
- [ ] WebSocket atualiza em tempo real
- [ ] Múltiplas instâncias funcionam
- [ ] Performance é aceitável

---

**Status**: 🟡 Planejamento Completo - Pronto para Iniciar Implementação
