
import { AlertTriangle, Stars, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { useSubscriptionBanner } from "../hooks/useSubscriptionBanner";
import { useState } from "react";
import { UpgradeModal } from "./UpgradeModal";

export function SubscriptionBanner() {
    const { status, loading } = useSubscriptionBanner();
    const [showUpgrade, setShowUpgrade] = useState(false);

    if (loading) return null;

    // Status Logic
    // If no subscription or status is 'none', maybe show nothing or generic 'Free Tier'
    const subStatus = status?.status || 'none';
    const trialEnd = status?.trial_end;
    const planName = status?.plan_name;

    // USER REQUEST: Only show upgrade banner for "Teste" plan.
    if (planName !== 'Teste' && planName !== 'teste') return null;

    // Logic for contextual messages
    let message = "";
    let icon = <Stars className="h-4 w-4" />;
    let variant = "promo"; // promo, warning, danger
    let actionLabel = "Fazer Upgrade";

    if (subStatus === 'trialing' && trialEnd) {
        const daysLeft = Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 3600 * 24));
        if (daysLeft > 0) {
            message = `🚀 Período de Teste Gratuito: Restam ${daysLeft} dias.`;
            actionLabel = "Assinar Agora";
        } else {
            message = "⚠️ Seu período de teste acabou. Algumas funcionalidades foram bloqueadas.";
            variant = "danger";
            icon = <AlertTriangle className="h-4 w-4" />;
        }
    } else if (subStatus === 'active') {
        // Since we filtered for Test plan above, if it's active, it's an active Test plan.
        message = "🚀 Você está no Plano Teste. Faça um upgrade para ter acesso ilimitado.";
        actionLabel = "Fazer Upgrade";
        variant = "promo";
    } else if (subStatus === 'past_due' || subStatus === 'cancelled') {
        message = "⚠️ Sua assinatura está pendente ou cancelada. Evite o bloqueio do sistema.";
        icon = <AlertTriangle className="h-4 w-4" />;
        variant = "danger";
        actionLabel = "Regularizar";
    } else if (subStatus === 'none') {
        // Maybe a visitor/free user
        message = "💎 Você está no plano Gratuito. Desbloqueie todo o potencial do sistema.";
        icon = <Zap className="h-4 w-4" />;
        variant = "promo";
    }

    if (!message) return null;

    const bgClass = variant === 'danger'
        ? "bg-red-600 text-white"
        : "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white animate-gradient-xy"; // Rich aesthetic

    return (
        <>
            <div className={`w-full px-4 py-2 text-sm font-medium flex items-center justify-between shadow-md z-30 transition-all ${bgClass}`}>
                <div className="flex items-center gap-2">
                    {icon}
                    <span>{message}</span>
                </div>
                <Button size="sm" variant="secondary" className="h-7 text-xs font-bold hover:bg-white/90 transition-colors" onClick={() => setShowUpgrade(true)}>
                    {actionLabel}
                </Button>
            </div>
            <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
        </>
    )
}
