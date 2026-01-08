
import { Lightbulb, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface ValueTipProps {
    title: string;
    description: string;
    feature: 'ai' | 'automation' | 'crm';
}

export function ValueTip({ title, description, feature }: ValueTipProps) {
    const [visible, setVisible] = useState(true);

    if (!visible) return null;

    const gradients = {
        ai: "from-blue-50 to-indigo-50 border-blue-100",
        automation: "from-purple-50 to-pink-50 border-purple-100",
        crm: "from-green-50 to-emerald-50 border-green-100"
    };

    const icons = {
        ai: "🤖",
        automation: "⚡",
        crm: "💼"
    };

    return (
        <div className={`relative flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-r ${gradients[feature]} shadow-sm mb-4 animate-in slide-in-from-top-2`}>
            <div className="text-2xl pt-1 select-none">{icons[feature]}</div>
            <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1 text-foreground/80">{title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-black/5 absolute top-2 right-2" onClick={() => setVisible(false)}>
                <X className="h-3 w-3" />
            </Button>
        </div>
    );
}
