
export const ROLES = {
    SUPERADMIN: 'SUPERADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    USER: 'USER',
    READ_ONLY: 'READ_ONLY',
    CUSTOM: 'CUSTOM'
};

export const PERMISSIONS = {
    FINANCE: {
        VIEW: 'finance.view',
        CREATE: 'finance.create',
        EDIT: 'finance.edit',
        DELETE: 'finance.delete',
        EXPORT: 'finance.export'
    },
    REGISTRATION: {
        COMPANIES: 'reg.companies',
        USERS: 'reg.users',
        CLIENTS: 'reg.clients',
        PROFESSIONALS: 'reg.professionals',
        PRODUCTS: 'reg.products',
        SERVICES: 'reg.services'
    },
    SCHEDULE: {
        VIEW: 'schedule.view',
        CREATE: 'schedule.create',
        EDIT: 'schedule.edit',
        CANCEL: 'schedule.cancel',
        DELETE: 'schedule.delete',
        VIEW_OTHERS: 'schedule.view_others'
    },
    CRM: {
        VIEW: 'crm.view',
        ATTEND: 'crm.attend',
        TRANSFER: 'crm.transfer',
        CLOSE: 'crm.close',
        MOVE_CARDS: 'crm.move_cards',
        EDIT_STAGES: 'crm.edit_stages'
    },
    BOT: {
        VIEW: 'bot.view',
        CREATE: 'bot.create',
        EDIT: 'bot.edit',
        PUBLISH: 'bot.publish',
        CONNECT: 'bot.connect',
        METRICS: 'bot.metrics'
    },
    CAMPAIGNS: {
        CREATE: 'campaigns.create',
        EDIT: 'campaigns.edit',
        SEND: 'campaigns.send',
        REPORT: 'campaigns.report'
    },
    INVENTORY: {
        VIEW: 'inventory.view',
        CREATE_PRODUCT: 'inventory.create_prod',
        EDIT_PRODUCT: 'inventory.edit_prod',
        DELETE_PRODUCT: 'inventory.delete_prod',
        SALE: 'inventory.sale',
        CANCEL_SALE: 'inventory.cancel_sale'
    },
    BI: {
        VIEW_DASHBOARD: 'bi.view',
        CREATE_REPORT: 'bi.create_report',
        EXPORT: 'bi.export'
    },
    SETTINGS: {
        COMPANY: 'settings.company',
        INTEGRATIONS: 'settings.integrations',
        WHATSAPP: 'settings.whatsapp',
        QRCODE: 'settings.qrcode',
        WEBHOOKS: 'settings.webhooks'
    }
};

// Flatten all permissions for easier checks
export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flatMap(group => Object.values(group));

export const DEFAULT_ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: ALL_PERMISSIONS,
    [ROLES.MANAGER]: [
        ...Object.values(PERMISSIONS.FINANCE),
        ...Object.values(PERMISSIONS.REGISTRATION),
        ...Object.values(PERMISSIONS.SCHEDULE),
        ...Object.values(PERMISSIONS.CRM),
        ...Object.values(PERMISSIONS.BOT),
        ...Object.values(PERMISSIONS.CAMPAIGNS),
        ...Object.values(PERMISSIONS.INVENTORY),
        ...Object.values(PERMISSIONS.BI),
        PERMISSIONS.SETTINGS.WHATSAPP,
        PERMISSIONS.SETTINGS.QRCODE
    ].filter(p => p !== PERMISSIONS.FINANCE.DELETE), // Managers can't delete finance? (User example 3)
    [ROLES.USER]: [
        PERMISSIONS.CRM.VIEW,
        PERMISSIONS.CRM.ATTEND,
        PERMISSIONS.SCHEDULE.VIEW,
        PERMISSIONS.SCHEDULE.CREATE,
        PERMISSIONS.INVENTORY.VIEW,
        PERMISSIONS.BI.VIEW_DASHBOARD
    ],
    [ROLES.READ_ONLY]: [
        PERMISSIONS.FINANCE.VIEW,
        PERMISSIONS.REGISTRATION.CLIENTS,
        PERMISSIONS.SCHEDULE.VIEW,
        PERMISSIONS.CRM.VIEW,
        PERMISSIONS.INVENTORY.VIEW,
        PERMISSIONS.BI.VIEW_DASHBOARD
    ],
    [ROLES.CUSTOM]: []
};
