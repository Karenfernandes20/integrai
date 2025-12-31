import { Card, CardContent } from "../ui/card";
import { MessageCircle, Users, Zap, MessageSquare, Wifi, CalendarClock, AlertCircle } from "lucide-react";

export const CrmOverviewCards = ({ data }: { data?: any }) => {
    const cards = [
        { label: "Conversas Ativas", value: data?.activeConversations || "0", sub: "No momento", icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
        { label: "Msgs Recebidas", value: data?.receivedMessages || "0", sub: "Hoje", icon: MessageSquare, color: "text-indigo-500", bg: "bg-indigo-500/10" },
        { label: "Clientes Atendidos", value: data?.attendedClients || "0", sub: "Hoje", icon: Users, color: "text-green-500", bg: "bg-green-500/10" },
        { label: "Novos Leads", value: data?.newLeads || "0", sub: "Hoje", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500/10" },
        { label: "Conexão WhatsApp", value: data?.whatsappStatus || "Offline", sub: "Status", icon: Wifi, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        { label: "Follow-ups", value: data?.followUpPending || "0", sub: "Pendentes", icon: CalendarClock, color: "text-blue-600", bg: "bg-blue-600/10" },
        { label: "Atrasados", value: data?.followUpOverdue || "0", sub: "Follow-ups", icon: AlertCircle, color: "text-red-600", bg: "bg-red-600/10" },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {cards.map((card, idx) => {
                const isWhatsapp = card.label === "Conexão WhatsApp";
                let iconColor = card.color;
                let bgColor = card.bg;

                if (isWhatsapp) {
                    const status = String(card.value).toLowerCase();
                    if (status === 'online') {
                        iconColor = "text-emerald-500";
                        bgColor = "bg-emerald-500/10";
                    } else if (status.includes('conectando')) {
                        iconColor = "text-yellow-500";
                        bgColor = "bg-yellow-500/10";
                    } else if (status.includes('qr')) {
                        iconColor = "text-orange-500";
                        bgColor = "bg-orange-500/10";
                    } else {
                        iconColor = "text-red-500";
                        bgColor = "bg-red-500/10";
                    }
                }

                return (
                    <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                        <CardContent className="p-4 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-start mb-2">
                                <div className={`p-1.5 rounded-md ${bgColor}`}>
                                    <card.icon className={`h-4 w-4 ${iconColor}`} />
                                </div>
                            </div>
                            <div>
                                <span className="text-2xl font-bold tracking-tight block">{card.value}</span>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-medium text-muted-foreground leading-tight mt-1">{card.label}</span>
                                    <span className="text-[10px] text-muted-foreground/70">{card.sub}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
