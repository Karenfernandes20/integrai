# Correção: Segunda Instância WhatsApp Não Salva Configurações

## Problema Relatado
Quando o usuário tenta configurar a segunda instância do WhatsApp (Evolution API), as configurações não são salvas corretamente e o QR Code não é puxado de forma independente.

## Problemas Identificados

### 1. **Backend - Sincronização de Instâncias Frágil** 
**Arquivo**: `server/controllers/companyController.ts`
- **Problema**: A função `updateCompany` usava index-based matching (`currentInsts[i]`) para mapear instâncias, o que causava problemas quando:
  - A segunda instância era criada sem ID inicialmente
  - O array de instâncias tinha índices faltando
  - Instâncias novas não retornavam o ID gerado
- **Solução**:
  - Implementar matching robusto por ID quando disponível
  - Adicionar fallback por index apenas quando necessário
  - Retornar TODAS as colunas com RETURNING em INSERTs e UPDATEs
  - Adicionar logging detalhado para diagnosticar

### 2. **Frontend - Construção Incorreta do Array de Instâncias**
**Arquivo**: `client/src/pages/QrCode.tsx`
- **Problema**: A lógica de construção de `allInstances` para envio ao backend tinha dois issues:
  1. Erro de precedência operacional: `if (trimmedInstance && (!id && slot === i) || (id && existing?.id === id))`
     - Deveria ser: `if (trimmedInstance && ((!id && slot === i) || (id && existing?.id === id)))`
  2. Não sincronizava corretamente o ID da segunda instância após criação

- **Solução**:
  - Corrigir precedência com parênteses explícitos
  - Adicionar fallback de matching por `instance_key` além de ID e slot_index
  - Adicionar logging para rastrear a construção do array

### 3. **Falta de Sincronização de IDs Pós-Criação**
**Problema**: Quando uma instância nova era criada, o `id` gerado no banco não era sincronizado de volta ao estado React antes da chamada de QR Code.
- **Solução**:
  - Implementar busca por instance_key como último recurso
  - Garantir que `setSelectedInstance` é chamado APÓS carregar instâncias do servidor

### 4. **campos de Entrada de Dados Sem Validação Adequada**
**Problema**: Campo `api_key` com tipo `password` pode ter issues com copy/paste ou rendering.
- **Solução**:
  - Validação correta com trim()
  - Feedback visual melhorado (validação em tempo real pendente)

## Correções Implementadas

### Backend - `server/controllers/companyController.ts`

1. **getCompanyInstances** (Linhas 792-875)
   - Adicionado logging detalhado
   - Retorna colunas específicas com timestamps
   - Melhor tratamento de sincronização de status

2. **updateCompanyInstance** (Linhas 877-927)
   - Valida uniqueness de instance_key corretamente
   - Retorna TODAS as colunas necessárias
   - Melhor logging de operações

3. **updateCompany - Seção de Sincronização** (Linhas 503-610)
   - Implementado matching robusto:
     ```typescript
     // Case 1: Usar ID se disponível
     if (def.id) {
       targetInst = currentInsts.find(ci => ci.id === def.id);
     }
     // Case 2: Usar index se for update
     else if (currentInsts[i]) {
       targetInst = currentInsts[i];
     }
     ```
   - INSERTs return TODAS as colunas necessárias
   - Tratamento de erro (23505 - unique violation) com retry key

### Frontend - `client/src/pages/QrCode.tsx`

1. **handleSaveCompany** (Linhas 308-393)
   - Construção corrigida de `allInstances` com precedência explícita
   - Sincronização de `selectedInstance` após servidor retornar
   - Fallback por instance_key adicionado
   - Logging detalhado de cada passo

2. **handleGenerateQrKey** (Linhas 120-180)
   - Lógica de salvamento pré-QR melhorada
   - Mesmo padrão de construção de array

3. **Cards WhatsApp** (Linhas 557-574)
   - Garantir `slot_index` é definido para instâncias novas

## Fluxo de Funcionamento Correto Agora

1. **Usuário abre segunda instância**
   ```typescript
   const instToEdit = instance || {
     name: `WhatsApp ${i + 1}`,  // WhatsApp 2
     instance_key: `empresa_2`,
     api_key: '',
     slot_index: 1  // Índice definido!
   };
   ```

2. **Usuário preenche dados e clica Salvar**
   - Validação verifica: name, instance_key, api_key
   - Array `allInstances` construído corretamente
   - PUT `/api/companies/id` envia `instanceDefinitions: [inst1, inst2]`

3. **Backend processa**
   - Busca `currentInsts` do banco (pode estar vazio ou ter inst1 já)
   - Para cada def em `parsedDefs`:
     - Se tem `id`: atualiza por ID
     - Senão se tem correspondência no índice: atualiza por índice
     - Senão: cria nova instância com RETURNING id
   - Log detalhado de cada operação

4. **Frontend Recebe Resposta**
   - Chama `GET /api/companies/id/instances` para refresh
   - Sincroniza `selectedInstance` por ID → index → instance_key
   - Estado React está atualizado

5. **Botão "Salvar e Conectar" (se clicado)**
   - Passa instância atualizada para `handleGenerateQrKey`
   - Faz requisição com `instanceKey` correto no query param
   - Backend resolve configuração correta via `getEvolutionConfig`

## Testes Recomendados

1. **Criar primeira instância**
   - Configurar "Recepção" com chave `recepção_1`
   - Salvar e gerar QR Code
   - Verificar no console: logs indicando ID retornado

2. **Criar segunda instância**
   - Configurar "Loja" com chave `loja_2`
   - Preencher API Key diferente
   - Salvar e gerar QR Code
   - Verificar no console: dois IDs diferentes, configs diferentes

3. **Editar segunda instância após criação**
   - Mudar nome ou API Key
   - Salvar novamente
   - Verificar que os dados persistem
   - QR Code continua funcionando

## Logs para Diagnóstico

O frontend agora loga:
```javascript
console.log("[QrCode] Building instanceDefinitions:", { maxSlots, selectedInstance, allInstances });
console.log("[QrCode] Adding edited instance at index i:", instance);
console.log("[QrCode] Save response status:", res.status);
console.log("[QrCode] Updated instances from server:", updatedInstances);
console.log("[QrCode] Synchronized selectedInstance with DB data:", updated);
```

O backend agora loga:
```
[Update Company id] Processing instances. Current: X, Definitions: Y
[Update Company id] Updating instance ID: name=X, key=Y
[Update Company id] Creating new instance: name=X, key=Y
[Update Company id] Created instance with ID: Z
[getCompanyInstances] Company id: Found N instances in DB
```

## Status de Implementação

✅ Corrigida a lógica de sincronização no backend
✅ Corrigida a construção do array no frontend  
✅ Melhorado o matching de instâncias por ID, index e instance_key
✅ Adicionado logging detalhado
✅ Garantido retorno de todas as colunas necessárias

**Pronto para fazer o deploy e testar!**
