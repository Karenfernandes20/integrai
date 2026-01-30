
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
    { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento", requiredPermission: "atendimentos" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard", requiredPermission: "dashboard" },
];

const GENERIC_MENU: MenuItem[] = [
    ...COMMON_ITEMS,
    { label: "Grupos", icon: Users, to: "/app/grupos", requiredPermission: "atendimentos" },
    { label: "Campanhas", icon: FileText, to: "/app/campanhas", requiredPermission: "atendimentos" },
    { label: "Follow-up", icon: CalendarCheck, to: "/app/follow-up", requiredPermission: "atendimentos" },
    { label: "Contatos", icon: Users, to: "/app/contatos", requiredPermission: "atendimentos" },
    { label: "CRM", icon: KanbanSquare, to: "/app/crm", requiredPermission: "crm" },
    { label: "Tags", icon: TagsIcon, to: "/app/tags", requiredPermission: "crm" },
    { label: "Financeiro", icon: Wallet2, to: "/app/financeiro", requiredPermission: "financeiro" },
    { label: "Usuários", icon: Users, to: "/app/usuarios", requiredPermission: "configuracoes" },
    { label: "Cidades", icon: MapPin, to: "/app/cidades", requiredPermission: "configuracoes" },
    { label: "QR Code", icon: QrCode, to: "/app/qr-code", requiredPermission: "configuracoes" },
    { label: "Ajuda / FAQ", icon: HelpCircle, to: "/app/faq" },
    { label: "Configurações", icon: Settings, to: "/app/configuracoes", requiredPermission: "configuracoes" },
];

const LOJA_MENU: MenuItem[] = [
    { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento", requiredPermission: "atendimentos" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard", requiredPermission: "dashboard" },
    { label: "Vendas", icon: ShoppingBag, to: "/app/loja/vendas", requiredPermission: "crm" },
    { label: "Clientes", icon: Users, to: "/app/contatos", requiredPermission: "atendimentos" }, // "Clientes" maps to Contatos
    { label: "Estoque", icon: Package, to: "/app/loja/estoque", requiredPermission: "financeiro" },
    { label: "Financeiro", icon: Wallet2, to: "/app/financeiro", requiredPermission: "financeiro" },
    { label: "Fornecedores", icon: Truck, to: "/app/loja/fornecedores", requiredPermission: "financeiro" },
    { label: "Campanhas", icon: FileText, to: "/app/campanhas", requiredPermission: "atendimentos" },
    { label: "Relatórios", icon: TrendingUp, to: "/app/relatorios", requiredPermission: "relatorios" },
    { label: "Metas & Equipe", icon: Target, to: "/app/loja/metas", requiredPermission: "relatorios" },
    { label: "IA Vendas", icon: Bot, to: "/app/ia", requiredPermission: "crm" },
    { label: "Configurações", icon: Settings, to: "/app/configuracoes", requiredPermission: "configuracoes" },
];

const RESTAURANTE_MENU: MenuItem[] = [
    { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento", requiredPermission: "atendimentos" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard", requiredPermission: "dashboard" },
    { label: "Pedidos", icon: ShoppingBag, to: "/app/pedidos", requiredPermission: "crm" },
    { label: "Mesas", icon: Coffee, to: "/app/mesas", requiredPermission: "crm" },
    { label: "Cozinha", icon: ChefHat, to: "/app/cozinha", requiredPermission: "crm" },
    { label: "Cardápio", icon: LayoutTemplate, to: "/app/cardapio", requiredPermission: "configuracoes" },
    { label: "Clientes", icon: Users, to: "/app/contatos", requiredPermission: "atendimentos" },
    { label: "Entregas", icon: Truck, to: "/app/entregas", requiredPermission: "crm" },
    { label: "Financeiro", icon: Wallet2, to: "/app/financeiro", requiredPermission: "financeiro" },
    { label: "Campanhas", icon: FileText, to: "/app/campanhas", requiredPermission: "atendimentos" },
    { label: "Relatórios", icon: TrendingUp, to: "/app/relatorios", requiredPermission: "relatorios" },
    { label: "Equipe", icon: Users, to: "/app/usuarios", requiredPermission: "configuracoes" },
    { label: "Configurações", icon: Settings, to: "/app/configuracoes", requiredPermission: "configuracoes" },
];

const LAVAJATO_MENU: MenuItem[] = [
    { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento", requiredPermission: "atendimentos" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard", requiredPermission: "dashboard" },
    { label: "Agenda", icon: CalendarCheck, to: "/app/agenda", requiredPermission: "crm" },
    { label: "Clientes", icon: Users, to: "/app/contatos", requiredPermission: "atendimentos" },
    { label: "Veículos", icon: Car, to: "/app/veiculos", requiredPermission: "crm" },
    { label: "Serviços", icon: Wrench, to: "/app/servicos", requiredPermission: "configuracoes" },
    { label: "Ordens de Serviço", icon: ClipboardList, to: "/app/os", requiredPermission: "crm" },
    { label: "Financeiro", icon: Wallet2, to: "/app/financeiro", requiredPermission: "financeiro" },
    { label: "Campanhas", icon: FileText, to: "/app/campanhas", requiredPermission: "atendimentos" },
    { label: "Relatórios", icon: TrendingUp, to: "/app/relatorios", requiredPermission: "relatorios" },
    { label: "Equipe", icon: Users, to: "/app/usuarios", requiredPermission: "configuracoes" },
    { label: "Configurações", icon: Settings, to: "/app/configuracoes", requiredPermission: "configuracoes" },
];

// Superadmin Items (Always injected if user is superadmin)
export const SUPERADMIN_ITEMS: MenuItem[] = [
    { label: "Clientes", icon: Building2, to: "/app/empresas", superAdminOnly: true },
    { label: "Tarefas", icon: CheckSquare, to: "/app/tarefas", superAdminOnly: true },
    { label: "Logs", icon: Terminal, to: "/app/logs", superAdminOnly: true },
    { label: "Alertas", icon: Bell, to: "/app/alertas", superAdminOnly: true },
    { label: "Saúde", icon: Activity, to: "/app/saude", superAdminOnly: true },
    { label: "IA", icon: Bot, to: "/app/ia", superAdminOnly: true },
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
        case 'CLINICA': return GENERIC_MENU;
        case 'TRANSPORTE': return GENERIC_MENU;
        default: return GENERIC_MENU;
    }
};
