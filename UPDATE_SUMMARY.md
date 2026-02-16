# Omnichannel Chatbot & Contact Migration Update

## 🚀 O que mudou?

O sistema foi elevado ao nível de plataformas profissionais como ManyChat e Zenvia, com foco em flexibilidade, robustez e experiência omnichannel.

### 1. Sistema de Contatos Unificado (Omnichannel)
- **Nova Tabela `contacts`**: Agora centraliza todos os leads (WhatsApp, Instagram, etc) em um só lugar.
- **Auto-Migração**: Os contatos antigos do WhatsApp foram migrados automaticamente para a nova estrutura.
- **Instagram Nativo**: O sistema agora busca e exibe o `@username` do Instagram em vez de IDs numéricos técnicos.
- **Performance**: Consultas SQL simplificadas e indexadas para carregar conversas e mensagens instantaneamente.

### 2. Chatbot Profissional (Engine v2)
- **Captura de Resposta**: O bloco de texto ganhou o poder de "esperar" o cliente. Você pode salvar o que ele digitar em qualquer variável (ex: `{{nome_cliente}}`).
- **Variáveis Dinâmicas**: Use `{{last_response}}` para repetir o que o cliente acabou de dizer ou use qualquer variável salva no fluxo.
- **Super IF (Condições)**: Novo conjunto de operadores:
  - *Numéricos*: "Maior que", "Menor ou igual", etc.
  - *Texto*: "Começa com", "Termina com", "Não contém".
- **Ações Estratégicas**:
  - **Mover Fila**: Envie a conversa para o setor correto.
  - **Atribuir Responsável**: Defina um usuário humano para assumir o chat.
  - **Ir para Fluxo**: Conecte chatbots diferentes (ex: Menu Principal -> Setor Financeiro).
  - **Encerrar**: Finalize atendimentos automaticamente.

### 3. Editor Visual (UX)
- Interface limpa e intuitiva para configurar as novas ações.
- Sincronização automática com suas Filas, Tags e Usuários cadastrados.

---

## 🛠 Como usar as novas funções:

1. **Capturar Nome**: No bloco de mensagem, marque "Capturar resposta" e defina a variável como `nome`. No próximo bloco, use `Olá {{nome}}!`.
2. **Triagem por ID**: No bloco IF, você pode testar se `{{last_response}}` é igual a "1" para enviar para a Fila de Vendas.
3. **Escopo de Variáveis**: Todas as respostas são salvas e podem ser usadas até o fim da sessão ou sobrescritas.

---

**Nota Técnica**: Foram aplicadas correções de transação SQL para garantir que o sistema nunca entre em modo de erro (Mock) por falhas parciais de salvamento.
