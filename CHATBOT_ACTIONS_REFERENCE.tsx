// TODAS AS AÇÕES DISPONÍVEIS NO CHATBOT - COPIAR ESTE CONTEÚDO PARA O SELECT

<optgroup label="📤 Mensagens">
    <option value="send_message">Enviar Mensagem</option>
    <option value="delay">Adicionar Delay/Pausa</option>
</optgroup>

<optgroup label="🎯 Gestão de Conversa">
    <option value="move_queue">Enviar para Fila</option>
    <option value="assign_user">Atribuir a Usuário</option>
    <option value="change_status">Mudar Status da Conversa</option>
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


// ===============================================
// CAMPOS DE CONFIGURAÇÃO PARA CADA AÇÃO
// ===============================================

// MOVE_QUEUE - Enviar para Fila
{
    node.data.action === 'move_queue' && (
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
    )
}

// CREATE_LEAD - Criar Lead no CRM
{
    node.data.action === 'create_lead' && (
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
    )
}

// CREATE_TASK - Criar Tarefa
{
    node.data.action === 'create_task' && (
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
    )
}

// DELAY - Adicionar Pausa
{
    node.data.action === 'delay' && (
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
    )
}

// WEBHOOK - Chamar API Externa
{
    node.data.action === 'webhook' && (
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
    )
}

// ADD_TAG / REMOVE_TAG
{
    (node.data.action === 'add_tag' || node.data.action === 'remove_tag') && (
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
    )
}
