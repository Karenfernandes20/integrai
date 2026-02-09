# 🤖 Aba Chatbot - Guia Técnico

Implementação do Construtor de Fluxos Visual (Internal SaaS).

## 🚀 Funcionalidades Implementadas

### 1. Dashboard de Bots (`/app/chatbot`)
- Listagem de todos os bots criados
- Status (Ativo/Inativo) e contagem de instâncias conectadas
- Menu de ações: Editar, Pausar/Ativar, Excluir
- Modal para criação rápida de novos bots

### 2. Editor Visual (`VisualEditor.tsx`)
- **Canvas Infinito**: Pan (botão do meio ou shift+click) e Zoom (scroll)
- **Drag & Drop**: Arraste nós livremente pelo canvas
- **Conexões**: Clique na bolinha direita (saída) de um nó e arraste até a esquerda (entrada) de outro
- **Tipos de Nós**:
  - ▶️ **Início** (Start)
  - 💬 **Mensagem** (Texto, imagem)
  - ❓ **Pergunta** (Captura de dados)
  - 🔀 **Condição** (Lógica IF/ELSE)
  - 👤 **Humano** (Transferência)
- **Salvar**: Persistência completa no banco de dados (nós e arestas)

### 3. Integração com Instâncias (`BotInstancesDialog.tsx`)
- Gerenciamento de quais números WhatsApp (instâncias) usam qual bot
- Interface simples com Switch (ON/OFF)
- Visualização do número (final) e nome amigável

## 💾 Estrutura de Dados (PostgreSQL)

Foram criadas 5 novas tabelas:
1. **`bots`**: Metadados do bot (nome, status interrupção)
2. **`bot_nodes`**: Blocos visuais (tipo, posição X/Y, conteúdo JSON)
3. **`bot_edges`**: Conexões entre blocos (origem -> destino)
4. **`bot_instances`**: Tabela de ligação (N:N) entre bots e instâncias do Evolution API
5. **`bot_sessions`**: (Futuro) Estado atual de cada contato no fluxo

## 🛠️ Como Usar

1. Acesse o menu **Chatbot** na barra lateral.
2. Clique em **"Novo Bot"** e dê um nome.
3. No card do bot, clique em **"Editar Fluxo"**.
4. No Editor:
   - Use a barra superior para adicionar blocos.
   - Arraste para organizar.
   - Conecte os blocos desenhando linhas.
   - Clique em **"Salvar"**.
5. Clique em **"Instâncias"** (topo direito) para conectar ao seu WhatsApp.

## ⚠️ Notas Técnicas

- O Editor Visual foi construído do zero usando React + SVG (sem dependências pesadas externas).
- A execução do bot (engine) não está ativa neste commit. A estrutura de dados está pronta para ser consumida pelo webhook (`webhookController.ts`).

## 🔜 Próximos Passos (Sugestão)

1. Implementar a **Engine de Execução** no `webhookController.ts`:
   - Ler mensagens recebidas
   - Verificar sessão ativa na tabela `bot_sessions`
   - Executar lógica do nó atual
   - Enviar resposta via Evolution API
2. Adicionar configuração detalhada nos nós (ex: editar texto da mensagem ao clicar no nó).
