
import {
    LayoutDashboard,
    MessageCircle,
    KanbanSquare,
    Wallet2,
    Users,
    MapPin,
    QrCode,
    Settings,
    Building2,
    FileText,
    CalendarCheck,
    CheckSquare,
    Terminal,
    Bell,
    Activity,
    HelpCircle,
    Bot,
    Fingerprint,
    LayoutTemplate,
    Map,
    Tags as TagsIcon,
    Car,
    Wrench,
    ClipboardList,
    TrendingUp,
    ShoppingBag,
    Coffee,
    ChefHat,
    Truck,
    Package,
    Target,
    Stethoscope,
} from "lucide-react";
import { OperationalProfile } from "../types";

export interface MenuItem {
    label: string;
    icon: any;
    to: string;
    requiredPermission?: string;
    superAdminOnly?: boolean;
}

const COMMON_ITEMS: MenuItem[] = [
    { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento", requiredPermission: "crm.view" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard", requiredPermission: "bi.view" },
];

const GENERIC_MENU: MenuItem[] = [
    ...COMMON_ITEMS,
    // Agenda removed from Generic
    { label: "Grupos", icon: Users, to: "/app/grupos", requiredPermission: "crm.view" },
    { label: "Campanhas", icon: FileText, to: "/app/campanhas", requiredPermission: "campaigns.send" },
    { label: "Follow-up", icon: CalendarCheck, to: "/app/follow-up", requiredPermission: "crm.view" },
    { label: "Contatos", icon: Users, to: "/app/contatos", requiredPermission: "reg.clients" },
    { label: "CRM", icon: KanbanSquare, to: "/app/crm", requiredPermission: "crm.view" },
    { label: "Tags", icon: TagsIcon, to: "/app/tags", requiredPermission: "crm.view" },
    { label: "Financeiro", icon: Wallet2, to: "/app/financeiro", requiredPermission: "finance.view" },
    { label: "Usuários", icon: Users, to: "/app/usuarios", requiredPermission: "reg.users" },
    { label: "Cidades", icon: MapPin, to: "/app/cidades", requiredPermission: "settings.company" },
    { label: "QR Code", icon: QrCode, to: "/app/qr-code", requiredPermission: "settings.qrcode" },
    { label: "Chatbot", icon: Bot, to: "/app/chatbot", requiredPermission: "bot.view" },
    { label: "Ajuda / FAQ", icon: HelpCircle, to: "/app/faq" },
    { label: "Configurações", icon: Settings, to: "/app/configuracoes", requiredPermission: "settings.company" },
];

const CLINICA_MENU: MenuItem[] = [
    { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento", requiredPermission: "crm.view" },
    { label: "Dashboard Clínico", icon: LayoutDashboard, to: "/app/dashboard", requiredPermission: "bi.view" },
    { label: "Agenda Avançada", icon: CalendarCheck, to: "/app/agenda", requiredPermission: "schedule.view" },
    { label: "Pacientes", icon: Users, to: "/app/contatos", requiredPermission: "reg.clients" },
    { label: "Grupos", icon: Users, to: "/app/grupos", requiredPermission: "crm.view" },
    { label: "Prontuário", icon: FileText, to: "/app/prontuario", requiredPermission: "crm.view" },
    { label: "Profissionais", icon: Stethoscope, to: "/app/profissionais", requiredPermission: "reg.professionals" },
    { label: "Convênios", icon: Building2, to: "/app/convenios", requiredPermission: "reg.services" },
    { label: "Financeiro Clínico", icon: Wallet2, to: "/app/financeiro", requiredPermission: "finance.view" },
    { label: "Estoque", icon: Package, to: "/app/estoque", requiredPermission: "inventory.view" },
    { label: "BI Clínico", icon: TrendingUp, to: "/app/bi-clinico", requiredPermission: "bi.view" },
    { label: "Chatbot", icon: Bot, to: "/app/chatbot", requiredPermission: "bot.view" },
    { label: "QR Code", icon: QrCode, to: "/app/qr-code", requiredPermission: "settings.qrcode" },
    { label: "Configurações", icon: Settings, to: "/app/configuracoes", requiredPermission: "settings.company" },
];

const LOJA_MENU: MenuItem[] = [
    { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento", requiredPermission: "crm.view" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard", requiredPermission: "bi.view" },
    { label: "Vendas", icon: ShoppingBag, to: "/app/loja/vendas", requiredPermission: "inventory.sale" },
    { label: "Clientes", icon: Users, to: "/app/contatos", requiredPermission: "reg.clients" }, // "Clientes" maps to Contatos
    { label: "Grupos", icon: Users, to: "/app/grupos", requiredPermission: "crm.view" },
    { label: "Estoque", icon: Package, to: "/app/loja/estoque", requiredPermission: "inventory.view" },
    { label: "Financeiro", icon: Wallet2, to: "/app/financeiro", requiredPermission: "finance.view" },
    { label: "Fornecedores", icon: Truck, to: "/app/loja/fornecedores", requiredPermission: "reg.clients" },
    { label: "Campanhas", icon: FileText, to: "/app/campanhas", requiredPermission: "campaigns.send" },
    { label: "Relatórios", icon: TrendingUp, to: "/app/relatorios", requiredPermission: "bi.view" },
    { label: "Metas & Equipe", icon: Target, to: "/app/loja/metas", requiredPermission: "bi.view" },
    { label: "QR Code", icon: QrCode, to: "/app/qr-code", requiredPermission: "settings.qrcode" },
    { label: "Chatbot", icon: Bot, to: "/app/chatbot", requiredPermission: "bot.view" },
    { label: "Configurações", icon: Settings, to: "/app/configuracoes", requiredPermission: "settings.company" },
];

const RESTAURANTE_MENU: MenuItem[] = [
    { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento", requiredPermission: "crm.view" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard", requiredPermission: "bi.view" },
    { label: "Pedidos", icon: ShoppingBag, to: "/app/pedidos", requiredPermission: "crm.view" },
    { label: "Mesas", icon: Coffee, to: "/app/mesas", requiredPermission: "crm.view" },
    { label: "Cozinha", icon: ChefHat, to: "/app/cozinha", requiredPermission: "crm.view" },
    { label: "Cardápio", icon: LayoutTemplate, to: "/app/cardapio", requiredPermission: "reg.products" },
    { label: "Clientes", icon: Users, to: "/app/contatos", requiredPermission: "reg.clients" },
    { label: "Grupos", icon: Users, to: "/app/grupos", requiredPermission: "crm.view" },
    { label: "Entregas", icon: Truck, to: "/app/entregas", requiredPermission: "crm.view" },
    { label: "Financeiro", icon: Wallet2, to: "/app/financeiro", requiredPermission: "finance.view" },
    { label: "Campanhas", icon: FileText, to: "/app/campanhas", requiredPermission: "campaigns.send" },
    { label: "Chatbot", icon: Bot, to: "/app/chatbot", requiredPermission: "bot.view" },
    { label: "Relatórios", icon: TrendingUp, to: "/app/relatorios", requiredPermission: "bi.view" },
    { label: "Equipe", icon: Users, to: "/app/usuarios", requiredPermission: "reg.users" },
    { label: "Configurações", icon: Settings, to: "/app/configuracoes", requiredPermission: "settings.company" },
];

const LAVAJATO_MENU: MenuItem[] = [
    { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento", requiredPermission: "crm.view" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard", requiredPermission: "bi.view" },
    { label: "Agenda", icon: CalendarCheck, to: "/app/agenda", requiredPermission: "schedule.view" },
    { label: "Clientes", icon: Users, to: "/app/contatos", requiredPermission: "reg.clients" },
    { label: "Grupos", icon: Users, to: "/app/grupos", requiredPermission: "crm.view" },
    { label: "Veículos", icon: Car, to: "/app/veiculos", requiredPermission: "crm.view" },
    { label: "Serviços", icon: Wrench, to: "/app/servicos", requiredPermission: "reg.services" },
    { label: "Ordens de Serviço", icon: ClipboardList, to: "/app/os", requiredPermission: "crm.view" },
    { label: "Financeiro", icon: Wallet2, to: "/app/financeiro", requiredPermission: "finance.view" },
    { label: "Campanhas", icon: FileText, to: "/app/campanhas", requiredPermission: "campaigns.send" },
    { label: "Chatbot", icon: Bot, to: "/app/chatbot", requiredPermission: "bot.view" },
    { label: "Relatórios", icon: TrendingUp, to: "/app/relatorios", requiredPermission: "bi.view" },
    { label: "Equipe", icon: Users, to: "/app/usuarios", requiredPermission: "reg.users" },
    { label: "Configurações", icon: Settings, to: "/app/configuracoes", requiredPermission: "settings.company" },
];

// Superadmin Items (Always injected if user is superadmin)
export const SUPERADMIN_ITEMS: MenuItem[] = [
    { label: "Clientes", icon: Building2, to: "/app/empresas", superAdminOnly: true },
    { label: "Tarefas", icon: CheckSquare, to: "/app/tarefas", superAdminOnly: true },
    { label: "Logs", icon: Terminal, to: "/app/logs", superAdminOnly: true },
    { label: "Alertas", icon: Bell, to: "/app/alertas", superAdminOnly: true },
    { label: "Saúde", icon: Activity, to: "/app/saude", superAdminOnly: true },
    { label: "Auditoria", icon: Fingerprint, to: "/app/auditoria", superAdminOnly: true },
    { label: "Templates", icon: LayoutTemplate, to: "/app/templates", superAdminOnly: true },
    { label: "Roadmap", icon: Map, to: "/app/roadmap", superAdminOnly: true },
];

export const getMenuByProfile = (profile: OperationalProfile = 'GENERIC'): MenuItem[] => {
    switch (profile) {
        case 'LOJA': return LOJA_MENU;
        case 'RESTAURANTE': return RESTAURANTE_MENU;
        case 'LAVAJATO': return LAVAJATO_MENU;
        // CLINICA & TRANSPORTE fall back to GENERIC for now as per requirements saying "Outros perfis Carregar presets próprios" but didn't specify distinct menus yet, or implies similar to generic but maybe different. 
        // User said: "OUTROS PERFIS: Carregar presets próprios." 
        // Since no detail for CLINICA/TRANSPORTE menu, I use GENERIC but this point is extensible.
        case 'CLINICA': return CLINICA_MENU;
        case 'TRANSPORTE': return GENERIC_MENU;
        default: return GENERIC_MENU;
    }
};
