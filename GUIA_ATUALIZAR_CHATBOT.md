# 🔧 GUIA DE ATUALIZAÇÃO DO CHATBOT - ADICIONAR TODAS AS AÇÕES

## 📍 Arquivo a editar:
`client/src/components/chatbot/VisualEditor.tsx`

## 📝 INSTRUÇÕES:

### 1. Localize a linha 506-515 (bloco do select de ações)

Procure por este código:
```tsx
<select
    className="w-full text-sm p-2 border rounded-md bg-white"
    value={node.data.action || 'create_lead'}
    onChange={e => updateData('action', e.target.value)}
>
    <option value="create_lead">Criar Lead no CRM</option>
    <option value="notify_admin">Notificar Administrador</option>
    <option value="external_webhook">Chamar Webhook Externo</option>
    <option value="add_tag">Adicionar Tag ao Contato</option>
</select>
```

### 2. SUBSTITUA TODO O CONTEÚDO ACIMA por:

```tsx
<select
    className="w-full text-sm p-2 border rounded-md bg-white"
    value={node.data.action || 'send_message'}
    onChange={e => updateData('action', e.target.value)}
>
    <optgroup label="📤 Mensagens">
        <option value="send_message">Enviar Mensagem</option>
        <option value="delay">Adicionar Delay/Pausa</option>
    </optgroup>
    
    <optgroup label="🎯 Gestão de Conversa">
        <option value="move_queue">Enviar para Fila</option>
        <option value="assign_user">Atribuir a Usuário</option>
        <option value="change_status">Mudar Status</option>
        <option value="close_conversation">Fechar Conversa</option>
        <option value="stop_chatbot">Parar Chatbot</option>
    </optgroup>
    
    <optgroup label="🏷️ Tags">
        <option value="add_tag">Adicionar Tag</option>
        <option value="remove_tag">Remover Tag</option>
    </optgroup>
    
    <optgroup label="💼 CRM & Tarefas">
        <option value="create_lead">Criar Lead no CRM</option>
        <option value="create_task">Criar Tarefa</option>
    </optgroup>
    
    <optgroup label="🔔 Notificações">
        <option value="send_notification">Enviar Notificação</option>
    </optgroup>
    
    <optgroup label="⚙️ Variáveis">
        <option value="set_variable">Definir Variável</option>
    </optgroup>
    
    <optgroup label="🔗 Integração">
        <option value="webhook">Chamar Webhook/API Externa</option>
    </optgroup>
</select>
```

### 3. Localize a linha 517-519 (o aviso de "Configurações adicionais...")

Procure por:
```tsx
<div className="p-3 bg-slate-50 rounded border border-dashed border-slate-300">
    <p className="text-[10px] text-slate-500">Configurações adicionais para esta ação estarão disponíveis na próxima atualização.</p>
</div>
```

### 4. SUBSTITUA por este código com os campos de configuração:

```tsx
{/* Configurações dinâmicas para cada ação */}
{node.data.action === 'send_message' && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Mensagem</label>
        <textarea
            className="w-full h-24 text-sm p-2 border rounded-md resize-none"
            value={node.data.messageContent || ''}
            onChange={e => updateData('messageContent', e.target.value)}
            placeholder="Digite a mensagem..."
        />
    </div>
)}

{node.data.action === 'move_queue' && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Nome da Fila</label>
        <input
            className="w-full text-sm p-2 border rounded-md"
            value={node.data.queueName || ''}
            onChange={e => updateData('queueName', e.target.value)}
            placeholder="Ex: Vendas, Suporte, Financeiro"
        />
        <p className="text-[10px] text-slate-400">A fila deve estar cadastrada no sistema</p>
    </div>
)}

{node.data.action === 'change_status' && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Novo Status</label>
        <select
            className="w-full text-sm p-2 border rounded-md bg-white"
            value={node.data.newStatus || 'PENDING'}
            onChange={e => updateData('newStatus', e.target.value)}
        >
            <option value="PENDING">Pendente</option>
            <option value="OPEN">Aberto</option>
            <option value="CLOSED">Fechado</option>
        </select>
    </div>
)}

{node.data.action === 'create_lead' && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Nome do Lead</label>
        <input
            className="w-full text-sm p-2 border rounded-md"
            value={node.data.leadName || ''}
            onChange={e => updateData('leadName', e.target.value)}
            placeholder="Use {{variavel}} para dados dinâmicos"
        />
        <label className="text-xs font-bold text-slate-500 uppercase mt-2">Email (Opcional)</label>
        <input
            type="email"
            className="w-full text-sm p-2 border rounded-md"
            value={node.data.leadEmail || ''}
            onChange={e => updateData('leadEmail', e.target.value)}
            placeholder="{{email}}"
        />
    </div>
)}

{node.data.action === 'create_task' && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Título da Tarefa</label>
        <input
            className="w-full text-sm p-2 border rounded-md"
            value={node.data.taskTitle || ''}
            onChange={e => updateData('taskTitle', e.target.value)}
            placeholder="Título da tarefa"
        />
        <label className="text-xs font-bold text-slate-500 uppercase mt-2">Descrição</label>
        <textarea
            className="w-full h-20 text-sm p-2 border rounded-md resize-none"
            value={node.data.taskDescription || ''}
            onChange={e => updateData('taskDescription', e.target.value)}
            placeholder="Detalhes da tarefa..."
        />
    </div>
)}

{node.data.action === 'delay' && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Tempo de Espera (segundos)</label>
        <input
            type="number"
            min="1"
            max="60"
            className="w-full text-sm p-2 border rounded-md"
            value={node.data.delaySeconds || 3}
            onChange={e => updateData('delaySeconds', Number(e.target.value))}
        />
    </div>
)}

{node.data.action === 'webhook' && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">URL do Webhook</label>
        <input
            type="url"
            className="w-full text-sm p-2 border rounded-md"
            value={node.data.webhookUrl || ''}
            onChange={e => updateData('webhookUrl', e.target.value)}
            placeholder="https://api.exemplo.com/webhook"
        />
    </div>
)}

{node.data.action === 'send_notification' && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Mensagem da Notificação</label>
        <textarea
            className="w-full h-20 text-sm p-2 border rounded-md resize-none"
            value={node.data.notificationMessage || ''}
            onChange={e => updateData('notificationMessage', e.target.value)}
            placeholder="Novo contato aguardando atendimento"
        />
    </div>
)}

{node.data.action === 'set_variable' && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Nome da Variável</label>
        <input
            className="w-full text-sm p-2 border rounded-md font-mono"
            value={node.data.varName || ''}
            onChange={e => updateData('varName', e.target.value)}
            placeholder="nome_variavel"
        />
        <label className="text-xs font-bold text-slate-500 uppercase mt-2">Valor</label>
        <input
            className="w-full text-sm p-2 border rounded-md"
            value={node.data.varValue || ''}
            onChange={e => updateData('varValue', e.target.value)}
            placeholder="valor ou {{outra_variavel}}"
        />
    </div>
)}

{(node.data.action === 'add_tag' || node.data.action === 'remove_tag') && (
    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">ID da Tag</label>
        <input
            type="number"
            className="w-full text-sm p-2 border rounded-md"
            value={node.data.tagId || ''}
            onChange={e => updateData('tagId', Number(e.target.value))}
            placeholder="1"
        />
        <p className="text-[10px] text-slate-400">Consulte o ID na seção de Tags do sistema</p>
    </div>
)}

{!['send_message', 'move_queue', 'change_status', 'create_lead', 'create_task', 'delay', 'webhook', 'send_notification', 'set_variable', 'add_tag', 'remove_tag'].includes(node.data.action) && (
    <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-xs text-blue-700">✓ Ação configurada com sucesso!</p>
    </div>
)}
```

## ✅ Depois de editar:
1. Salve o arquivo
2. O frontend será recarregado automaticamente
3. Acesse a página do Chatbot e crie/edite um bloco de "Ação"
4. Você verá todas as 15 opções organizadas em grupos!

## 📋 Resumo das Ações Disponíveis:

### Backend ✅ (já implementado em `chatbotService.ts`):
1. send_message
2. set_variable
3. move_queue
4. assign_user
5. add_tag
6. remove_tag
7. change_status
8. create_lead
9. create_task
10. send_notification
11. delay
12. stop_chatbot
13. webhook
14. close_conversation
15. handoff

### Frontend (precisa editar):
- Arquivo: `client/src/components/chatbot/VisualEditor.tsx`
- Linhas: 506-520 aproximadamente
