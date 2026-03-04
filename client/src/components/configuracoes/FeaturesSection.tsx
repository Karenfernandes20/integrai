
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Switch } from "../ui/switch";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../ui/tooltip";

interface Feature {
    id: string;
    label: string;
    description: string;
}

interface FeatureCategory {
    title: string;
    features: Feature[];
}

const FEATURE_CATEGORIES: FeatureCategory[] = [
    {
        title: "Atendimento",
        features: [
            { id: "multi_agents", label: "Múltiplos atendentes", description: "Permite que vários usuários atendam na mesma empresa simultaneamente." },
            { id: "conversation_transfer", label: "Transferência de conversa", description: "Habilita a transferência de chats entre atendentes e filas." },
            { id: "multi_queues", label: "Múltiplas filas", description: "Organize atendimentos por setores (Vendas, Suporte, etc)." },
            { id: "auto_close", label: "Encerramento automático", description: "Fecha conversas inativas após um período configurado." },
            { id: "supervisor_mode", label: "Modo supervisor", description: "Permite que gestores monitorem conversas em tempo real sem intervir." },
        ]
    },
    {
        title: "Automação",
        features: [
            { id: "chatbot", label: "Chatbot", description: "Ativa fluxos de resposta automática e menus de atendimento." },
            { id: "quick_replies", label: "Respostas rápidas", description: "Habilita o uso de atalhos para mensagens frequentes." },
            { id: "auto_messages", label: "Mensagens automáticas", description: "Envio de saudações e mensagens de ausência fora de horário." },
            { id: "auto_assign", label: "Distribuição automática", description: "Distribui novos leads entre os atendentes disponíveis." },
            { id: "sla", label: "Controle de SLA", description: "Monitora o tempo de resposta e alerta sobre atrasos." },
        ]
    },
    {
        title: "IA",
        features: [
            { id: "ai_assistant", label: "Assistente de IA", description: "Usa IA para auxiliar os atendentes na redação de respostas." },
            { id: "ai_auto_reply", label: "IA responder automaticamente", description: "Permite que a IA responda clientes sem intervenção humana." },
            { id: "ai_suggestions", label: "Sugestão de respostas", description: "A IA sugere a melhor resposta baseada no histórico." },
            { id: "sentiment_analysis", label: "Análise de sentimento", description: "Identifica se o cliente está satisfeito, neutro ou irritado." },
        ]
    },
    {
        title: "Relatórios",
        features: [
            { id: "advanced_reports", label: "Relatórios avançados", description: "Acesso a métricas detalhadas de desempenho e produtividade." },
            { id: "export_csv", label: "Exportação CSV", description: "Permite exportar dados brutos para planilhas." },
            { id: "export_pdf", label: "Exportação PDF", description: "Gera relatórios formatados prontos para impressão." },
            { id: "dashboard_manager", label: "Dashboard gerencial", description: "Visão consolidada de todas as operações em um único painel." },
        ]
    },
    {
        title: "Segurança",
        features: [
            { id: "2fa_enabled", label: "Autenticação 2FA", description: "Exige uma segunda camada de segurança para login." },
            { id: "activity_log", label: "Log de atividades", description: "Registro detalhado de todas as ações realizadas no sistema." },
            { id: "ip_restriction", label: "Restrição por IP", description: "Permite acesso apenas de IPs autorizados." },
            { id: "session_control", label: "Controle de sessão", description: "Gerencia e desconecta sessões ativas remotamente." },
        ]
    },
    {
        title: "Clientes",
        features: [
            { id: "edit_contact", label: "Edição de contato", description: "Permite alterar dados dos clientes durante o atendimento." },
            { id: "delete_conversation", label: "Exclusão de conversa", description: "Habilita a remoção definitiva do histórico de chats." },
            { id: "full_history", label: "Histórico completo", description: "Visualização de todas as interações passadas do cliente." },
            { id: "custom_tags", label: "Tags personalizadas", description: "Criação de etiquetas próprias para segmentação de clientes." },
        ]
    }
];

export const FeaturesSection = () => {
    const { token, user, featureFlags, refreshFeatureFlags } = useAuth();

    const handleToggle = async (key: string, enabled: boolean) => {
        try {
            const res = await fetch(`/api/companies/${user?.company_id}/features/toggle`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ feature_key: key, is_enabled: enabled })
            });
            if (res.ok) {
                await refreshFeatureFlags();
                toast.success(`${enabled ? 'Ativado' : 'Desativado'} com sucesso!`);
            } else {
                throw new Error("Falha ao salvar");
            }
        } catch (e) {
            toast.error("Erro ao alterar funcionalidade");
        }
    };

    return (
        <div className="space-y-8">
            <header>
                <h3 className="text-lg font-semibold mb-1">Controle de Funcionalidades do Sistema</h3>
                <p className="text-sm text-muted-foreground">Ative ou desative recursos específicos para personalizar sua experiência.</p>
            </header>

            <TooltipProvider>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {FEATURE_CATEGORIES.map((category) => (
                        <Card key={category.title} className="flex flex-col">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                    {category.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-0 flex-grow">
                                {category.features.map((feature) => (
                                    <div key={feature.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-2">
                                            <label
                                                htmlFor={`feature-${feature.id}`}
                                                className="text-sm font-medium cursor-pointer group-hover:text-primary transition-colors"
                                            >
                                                {feature.label}
                                            </label>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info size={14} className="text-muted-foreground/50 cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="max-w-xs">{feature.description}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                        <Switch
                                            id={`feature-${feature.id}`}
                                            checked={!!featureFlags[feature.id]}
                                            onCheckedChange={(checked) => handleToggle(feature.id, checked)}
                                        />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </TooltipProvider>
        </div>
    );
};
