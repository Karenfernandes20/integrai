
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import {
    MessageSquare,
    Settings2,
    Globe,
    Database,
    CreditCard,
    Mail,
    Sparkles,
    Building2,
    Calendar,
    Target,
    Layout,
    CheckCircle2,
    XCircle,
} from "lucide-react";

interface IntegrationCardProps {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    isEnabled: boolean;
    isConnected: boolean;
    onToggle: (id: string, enabled: boolean) => void;
    onConfigure: (id: string) => void;
}

const IntegrationCard = ({
    id, title, description, icon: Icon, isEnabled, isConnected, onToggle, onConfigure
}: IntegrationCardProps) => {
    return (
        <Card className={`transition-all duration-200 ${isEnabled ? 'border-primary/20 bg-primary/5' : 'opacity-60 grayscale'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                    </div>
                </div>
                <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => onToggle(id, checked)}
                />
            </CardHeader>
            <CardContent>
                <CardDescription className="text-xs mb-4 line-clamp-2 min-h-[32px]">
                    {description}
                </CardDescription>

                <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1.5">
                        {isConnected ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] gap-1 px-1.5">
                                <CheckCircle2 size={10} /> Conectado
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent text-[10px] gap-1 px-1.5">
                                <XCircle size={10} /> Não Conectado
                            </Badge>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[11px] gap-1"
                        disabled={!isEnabled}
                        onClick={() => onConfigure(id)}
                    >
                        <Settings2 size={12} /> Configurar
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export const IntegrationsSection = () => {
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

    const integrations = [
        {
            id: "whatsapp_official",
            title: "API Oficial",
            description: "Conexão via Meta Cloud API com suporte a botões e templates.",
            icon: MessageSquare,
            isConnected: true,
        },
        {
            id: "whatsapp_internal",
            title: "API Interna (Mini Evolution)",
            description: "Conexão via QR Code ideal para números pessoais e pequenas empresas.",
            icon: Globe,
            isConnected: false,
        },
        {
            id: "webhook",
            title: "Webhooks",
            description: "Dispare notificações para outros sistemas em tempo real.",
            icon: Database,
            isConnected: true,
        },
        {
            id: "crm_integration",
            title: "Integração CRM",
            description: "Sincronize contatos e oportunidades com seu CRM externo.",
            icon: Layout,
            isConnected: false,
        },
        {
            id: "payment_gateway",
            title: "Gateway de Pagamento",
            description: "Receba pagamentos via PIX, Cartão ou Boleto diretamente no chat.",
            icon: CreditCard,
            isConnected: false,
        },
        {
            id: "email_integration",
            title: "E-mail",
            description: "Envio de relatórios e notificações por correio eletrônico.",
            icon: Mail,
            isConnected: false,
        },
        {
            id: "ai_integration",
            title: "Inteligência Artificial",
            description: "Conecte OpenAI ou Anthropic para processamento de mensagens.",
            icon: Sparkles,
            isConnected: true,
        },
        {
            id: "erp_integration",
            title: "ERP",
            description: "Integração com sistemas de gestão e estoque.",
            icon: Building2,
            isConnected: false,
        },
        {
            id: "google_integration",
            title: "Google (Agenda/Contatos)",
            description: "Sincronize compromissos e agenda de contatos.",
            icon: Calendar,
            isConnected: false,
        },
        {
            id: "meta_ads",
            title: "Meta Ads (Click to WhatsApp)",
            description: "Rastreio e conversão de anúncios do Facebook e Instagram.",
            icon: Target,
            isConnected: false,
        },
        {
            id: "web_chat",
            title: "Chat Web (Widget)",
            description: "Widget de atendimento para instalar em seu site.",
            icon: Layout,
            isConnected: false,
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {integrations.map((integration) => (
                <IntegrationCard
                    key={integration.id}
                    id={integration.id}
                    title={integration.title}
                    description={integration.description}
                    icon={integration.icon}
                    isEnabled={!!featureFlags[integration.id]}
                    isConnected={integration.isConnected}
                    onToggle={handleToggle}
                    onConfigure={(id) => toast.info(`Configurações de ${id} em breve.`)}
                />
            ))}
        </div>
    );
};
