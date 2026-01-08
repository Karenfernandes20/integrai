# REGRA DE NEGÓCIO: UNIFICAÇÃO DE CONVERSAS E EVITAÇÃO DE DUPLICIDADE

## Data: 2026-01-07

## Problema Identificado
O sistema estava criando múltiplas conversas para o mesmo contato, muitas vezes usando identificadores numéricos ou JIDs de dispositivos diferentes (ex: `...:1@s.whatsapp.net` vs `...:2@s.whatsapp.net`).

## Solução Implementada

### 1. Normalização Agressiva de JID (Device Strip) ✅
- **Regra**: Todo JID recebido do Evolution API é higienizado.
- **Ação**: Removemos qualquer sufixo de dispositivo (`:1`, `:2`, etc.) antes de buscar ou salvar no banco de dados.
- **Resultado**: `5511999999999:1@s.whatsapp.net` e `5511999999999:5@s.whatsapp.net` agora são mapeados para a **MESMA** conversa.

### 2. Vinculação por Telefone (Fallback de Ouro) ✅
- **Regra**: Se não encontrar pelo identificador (JID), o sistema busca pelo número de telefone puro.
- **Ação**: O sistema tenta variações do número (com 55, sem 55) dentro da mesma empresa.
- **Resultado**: Se o contato trocar de aparelho ou o JID mudar por algum motivo técnico, a conversa antiga é reutilizada e o novo JID é vinculado a ela automaticamente.

### 3. Proibição de Identificadores Técnicos como Nome ✅
- **Regra**: O sistema prioriza o nome de perfil (PushName) ou um nome amigável.
- **Ação**: Se um contato novo envia mensagem e não temos nome, usamos o telefone formatado, nunca IDs internos ou hashes longos.

### 4. Inteligência de Status (Reabertura Automática) ✅
- **Inbound**: Se uma mensagem chega para uma conversa `CLOSED`, ela é automaticamente movida para `PENDING`.
- **Outbound**: Se enviamos uma mensagem (via API ou Celular) para uma conversa `CLOSED`, ela é movida para `OPEN`.

## Princípios de Funcionamento

1. **JID Normalizado** -> Busca no BD.
2. **Falhou?** -> Busca por **Telefone** (Variações).
3. **Achou?** -> Vincula a nova mensagem à conversa existente (mesmo ID de banco).
4. **Não achou nada?** -> Só então cria uma nova conversa.

## Como Testar

1. **Teste de Dispositivo**:
   - Envie uma mensagem do seu WhatsApp.
   - Force o envio de outra mensagem de um dispositivo vinculado diferente (ou via API com sufixo `:1`).
   - Verifique se ambas aparecem na **mesma thread** de chat no Integrai.

2. **Teste de Reaparecimento**:
   - Feche uma conversa (`CLOSED`).
   - Mande um "Oi" do celular do cliente.
   - A conversa deve reaparecer na aba **PENDENTE** imediatamente.

3. **Teste de Nome**:
   - Verifique se no topo do chat aparece o nome do contato ou o número, e **nunca** algo como `1234567890:1@s.whatsapp.net`.

## Impacto Técnico
- Redução drástica de lixo no banco de dados.
- Melhor experiência para o atendente (histórico unificado).
- Fim das conversas fantasmas com nomes numéricos.

---
**Status**: 🚀 IMPLEMENTADO E PUBLICADO
**Prioridade**: ABSOLUTA (Conforme Regras de Negócio)
