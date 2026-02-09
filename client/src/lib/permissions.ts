
export const PERMISSION_GROUPS = [
    {
        name: "📊 Financeiro",
        permissions: [
            { id: 'finance.view', label: 'Visualizar financeiro' },
            { id: 'finance.create', label: 'Criar cobranças' },
            { id: 'finance.edit', label: 'Editar cobranças' },
            { id: 'finance.delete', label: 'Excluir cobranças' },
            { id: 'finance.export', label: 'Exportar relatórios' }
        ]
    },
    {
        name: "📋 Cadastros",
        permissions: [
            { id: 'reg.companies', label: 'Empresas' },
            { id: 'reg.users', label: 'Usuários' },
            { id: 'reg.clients', label: 'Clientes' },
            { id: 'reg.professionals', label: 'Profissionais' },
            { id: 'reg.products', label: 'Produtos' },
            { id: 'reg.services', label: 'Serviços' }
        ]
    },
    {
        name: "📅 Agendamentos",
        permissions: [
            { id: 'schedule.view', label: 'Visualizar agenda' },
            { id: 'schedule.create', label: 'Criar agendamento' },
            { id: 'schedule.edit', label: 'Editar agendamento' },
            { id: 'schedule.cancel', label: 'Cancelar agendamento' },
            { id: 'schedule.delete', label: 'Excluir agendamento' },
            { id: 'schedule.view_others', label: 'Ver agenda de outros usuários' }
        ]
    },
    {
        name: "💬 Atendimentos / CRM",
        permissions: [
            { id: 'crm.view', label: 'Visualizar atendimentos' },
            { id: 'crm.attend', label: 'Atender clientes' },
            { id: 'crm.transfer', label: 'Transferir atendimento' },
            { id: 'crm.close', label: 'Encerrar atendimento' },
            { id: 'crm.move_cards', label: 'Mover cards no CRM' },
            { id: 'crm.edit_stages', label: 'Editar etapas do funil' }
        ]
    },
    {
        name: "🤖 Chatbot",
        permissions: [
            { id: 'bot.view', label: 'Visualizar chatbots' },
            { id: 'bot.create', label: 'Criar chatbot' },
            { id: 'bot.edit', label: 'Editar chatbot' },
            { id: 'bot.publish', label: 'Publicar chatbot' },
            { id: 'bot.connect', label: 'Conectar chatbot a números' },
            { id: 'bot.metrics', label: 'Visualizar métricas' }
        ]
    },
    {
        name: "📣 Campanhas",
        permissions: [
            { id: 'campaigns.create', label: 'Criar campanhas' },
            { id: 'campaigns.edit', label: 'Editar campanhas' },
            { id: 'campaigns.send', label: 'Disparar campanhas' },
            { id: 'campaigns.report', label: 'Ver relatórios' }
        ]
    },
    {
        name: "📦 Estoque / Vendas",
        permissions: [
            { id: 'inventory.view', label: 'Visualizar estoque' },
            { id: 'inventory.create_prod', label: 'Criar produto' },
            { id: 'inventory.edit_prod', label: 'Editar produto' },
            { id: 'inventory.delete_prod', label: 'Excluir produto' },
            { id: 'inventory.sale', label: 'Registrar venda' },
            { id: 'inventory.cancel_sale', label: 'Cancelar venda' }
        ]
    },
    {
        name: "📈 BI / Relatórios",
        permissions: [
            { id: 'bi.view', label: 'Visualizar dashboards' },
            { id: 'bi.create_report', label: 'Criar relatórios' },
            { id: 'bi.export', label: 'Exportar dados' }
        ]
    },
    {
        name: "⚙️ Configurações",
        permissions: [
            { id: 'settings.company', label: 'Configurações da empresa' },
            { id: 'settings.integrations', label: 'Integrações' },
            { id: 'settings.whatsapp', label: 'Instâncias WhatsApp' },
            { id: 'settings.qrcode', label: 'QR Code' },
            { id: 'settings.webhooks', label: 'Webhooks / n8n' }
        ]
    }
];

export const ROLE_PRESETS: Record<string, string[]> = {
    ADMIN: [
        'finance.view', 'finance.create', 'finance.edit', 'finance.delete', 'finance.export',
        'reg.companies', 'reg.users', 'reg.clients', 'reg.professionals', 'reg.products', 'reg.services',
        'schedule.view', 'schedule.create', 'schedule.edit', 'schedule.cancel', 'schedule.delete', 'schedule.view_others',
        'crm.view', 'crm.attend', 'crm.transfer', 'crm.close', 'crm.move_cards', 'crm.edit_stages',
        'bot.view', 'bot.create', 'bot.edit', 'bot.publish', 'bot.connect', 'bot.metrics',
        'campaigns.create', 'campaigns.edit', 'campaigns.send', 'campaigns.report',
        'inventory.view', 'inventory.create_prod', 'inventory.edit_prod', 'inventory.delete_prod', 'inventory.sale', 'inventory.cancel_sale',
        'bi.view', 'bi.create_report', 'bi.export',
        'settings.company', 'settings.integrations', 'settings.whatsapp', 'settings.qrcode', 'settings.webhooks'
    ],
    MANAGER: [
        'finance.view', 'finance.export',
        'reg.clients', 'reg.professionals', 'reg.products', 'reg.services',
        'schedule.view', 'schedule.create', 'schedule.edit', 'schedule.view_others',
        'crm.view', 'crm.attend', 'crm.transfer', 'crm.close', 'crm.move_cards',
        'bot.view', 'bot.metrics',
        'campaigns.report',
        'inventory.view', 'inventory.sale',
        'bi.view', 'bi.export'
    ],
    VENDEDOR: [
        'reg.clients',
        'schedule.view', 'schedule.create',
        'crm.view', 'crm.attend', 'crm.move_cards',
        'inventory.view', 'inventory.sale'
    ],
    ATENDENTE: [
        'reg.clients',
        'schedule.view', 'schedule.create',
        'crm.attend'
    ],
    FINANCEIRO: [
        'finance.view', 'finance.create', 'finance.edit', 'finance.export',
        'inventory.view', 'inventory.sale'
    ],
    USUARIO: [
        'schedule.view', 'schedule.create'
    ]
};
