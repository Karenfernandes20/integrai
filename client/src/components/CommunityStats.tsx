
import { Building2, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

export function CommunityStats() {
    const [stats, setStats] = useState({ companies: 120, messages: 4500 }); // Mock starting stats

    useEffect(() => {
        // Simulate live stats slightly increasing to feel alive
        const interval = setInterval(() => {
            setStats(s => ({
                companies: s.companies,
                messages: s.messages + Math.floor(Math.random() * 3)
            }));
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center justify-center gap-6 mt-12 py-6 border-t border-border/40 text-muted-foreground text-xs">
            <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3" />
                <span><strong className="text-foreground">{stats.companies}+</strong> Empresas Ativas</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
            <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3" />
                <span><strong className="text-foreground">{stats.messages.toLocaleString()}+</strong> Mensagens hoje</span>
            </div>
        </div>
    );
}
