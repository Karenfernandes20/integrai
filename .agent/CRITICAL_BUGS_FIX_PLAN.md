# 🔧 PLANO DE CORREÇÃO DE BUGS CRÍTICOS

## 📋 RESUMO EXECUTIVO
Este documento detalha o plano de correção para 5 bugs críticos identificados no sistema Integrai.

---

## 1️⃣ BUG: CRM → ADICIONAR LEADS (Contatos não aparecem)

### 🔍 Análise
**Arquivo:** `client/src/pages/CRM.tsx` (linhas 276-291)
**Problema:** A função `fetchContacts()` está chamando `/api/evolution/contacts`, mas não há validação de:
- Filtros ativos (status, exclusão lógica)
- Estados de loading
- Mensagens de erro amigáveis

### ✅ Correções Necessárias
1. **Backend:** Verificar endpoint `/api/evolution/contacts`
   - Garantir que retorna apenas contatos ativos
   - Aplicar filtros corretos (company_id, status)
   
2. **Frontend:** Melhorar UX em `CRM.tsx`
   - Adicionar loading state durante fetch
   - Exibir mensagem quando não houver contatos
   - Implementar paginação/lazy load se necessário
   - Tratar erros silenciosos

### 📝 Arquivos a Modificar
- `server/controllers/evolutionController.ts` ou `server/controllers/contactController.ts`
- `client/src/pages/CRM.tsx` (linhas 276-291, 753-810)

---

## 2️⃣ BUG: CLIENTES → ERRO AO ABRIR MENSAGENS

### 🔍 Análise
**Problema:** Ao clicar em "Mensagens" de um cliente, abre aba Atendimento com erro
**Causa Provável:**
- `cliente_id` não está sendo passado corretamente
- Conversa não é criada automaticamente
- Rota com parâmetros `undefined`

### ✅ Correções Necessárias
1. **Validar navegação:** Verificar como o botão "Mensagens" chama a aba Atendimento
2. **Auto-criar conversa:** Se não existir conversa, criar automaticamente
3. **Validar vínculo:** Garantir que cliente → canal → atendimento estão vinculados

### 📝 Arquivos a Modificar
- Buscar arquivo de "Clientes" (não encontrado ainda - precisa ser localizado)
- `client/src/pages/Atendimento.tsx`
- Backend: Controller de conversas

---

## 3️⃣ BUG: VENDAS → ESTOQUE NEGATIVO

### 🔍 Análise
**Arquivo:** `client/src/components/shop-dashboard/CreateSaleDialog.tsx`
**Problema:** É possível adicionar mais itens do que o estoque disponível

**Validações Existentes (Frontend):**
- ✅ Linha 151-158: Valida estoque ao adicionar item
- ✅ Linha 328-333: Input com `max` definido
- ✅ Linha 169: Limita quantidade ao estoque

**Problema Identificado:**
- ❌ Falta validação no BACKEND
- ❌ Possível manipulação de quantidade após adicionar ao carrinho

### ✅ Correções Necessárias
1. **Backend:** Adicionar validação em `/api/shop/sales`
   - Verificar estoque antes de salvar venda
   - Rejeitar venda se estoque insuficiente
   - Nunca permitir estoque negativo no banco

2. **Frontend:** Reforçar validações
   - Bloquear edição de quantidade no carrinho se exceder estoque
   - Validar novamente antes de enviar ao backend

### 📝 Arquivos a Modificar
- `server/controllers/shopController.ts` (ou similar)
- `client/src/components/shop-dashboard/CreateSaleDialog.tsx` (adicionar validação no carrinho)

---

## 4️⃣ BUG: METAS → DIVISÃO E SALVAMENTO

### 🔍 Análise
**Problemas:**
1. Botão "Dividir meta por vendedor" não funciona
2. Metas aparecem visualmente mas não salvam no banco

### ✅ Correções Necessárias
1. **Divisão por vendedor:**
   - Dividir automaticamente meta total / número de vendedores ativos
   - Permitir edição individual após divisão
   - Atualizar valores ao adicionar/remover vendedores

2. **Salvamento:**
   - Garantir persistência no banco antes de exibir
   - Corrigir chamada da API
   - Tratar erros silenciosos
   - Adicionar toasts de sucesso/erro

### 📝 Arquivos a Modificar
- Buscar arquivo de "Metas" (precisa ser localizado)
- Backend: Controller de metas

---

## 5️⃣ BUG: ATENDIMENTO → FIGURINHAS E FECHAMENTO

### 🔍 Análise
**Arquivo:** `client/src/pages/Atendimento.tsx`

**Problemas:**
1. ❌ Figurinhas não aparecem
2. ❌ Ao fechar conversa em "Pendentes":
   - Solicita motivo mas não mostra opções
   - Não finaliza a conversa

### ✅ Correções Necessárias

#### A. Figurinhas
- Tratar mensagens tipo `stickerMessage`
- Renderizar figurinha no chat
- Placeholder se não suportado: "🎨 Figurinha recebida"

#### B. Fechar Conversa
**Frontend:**
- Linha 337-343: Estados de fechamento já existem
- Linha 364-379: `fetchClosingReasons()` já implementado
- **PROBLEMA:** Verificar se motivos estão sendo carregados corretamente

**Backend:**
- Garantir que `/api/closing-reasons?onlyActive=true` retorna dados
- Motivos obrigatórios:
  - Finalizado com sucesso
  - Cliente não respondeu
  - Venda concluída
  - Outro

**Após fechamento:**
- Atualizar status no banco
- Remover da lista de pendentes
- Atualizar UI automaticamente
- Exibir toast: "Conversa encerrada"

### 📝 Arquivos a Modificar
- `client/src/pages/Atendimento.tsx` (renderização de mensagens + modal de fechamento)
- `server/controllers/closingReasonController.ts`
- `server/controllers/conversationController.ts`

---

## 🔒 REGRAS GERAIS DE IMPLEMENTAÇÃO

1. ✅ Não quebrar funcionalidades existentes
2. ✅ Corrigir erros no console
3. ✅ Padronizar mensagens de erro e sucesso
4. ✅ Garantir consistência entre frontend, backend e banco
5. ✅ Testar fluxo completo após as correções
6. ✅ Tratar estados de loading e erro corretamente
7. ✅ Validação dupla: Frontend (UX) + Backend (Segurança)

---

## 📊 PRIORIZAÇÃO

### 🔴 CRÍTICO (Fazer Primeiro)
1. **Vendas → Estoque Negativo** (Impacto financeiro direto)
2. **Atendimento → Fechar Conversa** (Bloqueia workflow)

### 🟡 ALTO (Fazer em Seguida)
3. **CRM → Adicionar Leads** (Impacta vendas)
4. **Clientes → Mensagens** (Experiência do usuário)

### 🟢 MÉDIO (Fazer por Último)
5. **Metas → Divisão e Salvamento** (Funcionalidade adicional)
6. **Atendimento → Figurinhas** (Melhoria de UX)

---

## 🚀 PRÓXIMOS PASSOS

1. Localizar arquivos faltantes (Clientes, Metas)
2. Analisar controllers do backend
3. Implementar correções na ordem de prioridade
4. Testar cada correção individualmente
5. Teste de integração completo
