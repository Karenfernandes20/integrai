import { Badge } from "./ui/badge";
import { Smartphone } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";

interface InstanceTagProps {
    instanceName?: string;
    color?: string;
    variant?: "default" | "compact";
    className?: string;
}

/**
 * Tag visual para exibir o nome comercial da instância WhatsApp
 * Usa: <InstanceTag instanceName={conversation.instance_friendly_name} color={conversation.instance_color} />
 */
export function InstanceTag({ instanceName, color, variant = "default", className = "" }: InstanceTagProps) {
    if (!instanceName) return null;

    const isCompact = variant === "compact";
    const tagColor = color || '#3b82f6';

    const getContrastTextColor = (hexColor: string) => {
        const hex = hexColor.replace('#', '');
        if (hex.length !== 6) return '#FFFFFF';

        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        return luminance > 0.6 ? '#0F172A' : '#FFFFFF';
    };

    const textColor = getContrastTextColor(tagColor);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        style={{
                            backgroundColor: tagColor,
                            color: textColor,
                            borderColor: tagColor
                        }}
                        className={`
              ${isCompact ? 'text-[9px] px-1.5 py-0 h-4' : 'text-[10px] px-2 py-0.5 h-5'} 
              transition-all 
              font-extrabold
              uppercase 
              tracking-wider
              flex 
              items-center 
              gap-1
              ${className}
            `}
                    >
                        <Smartphone className={`${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                        <span className="truncate max-w-[120px]">{instanceName}</span>
                    </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                    <p>Instância: <strong>{instanceName}</strong></p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        Canal WhatsApp ativo
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
