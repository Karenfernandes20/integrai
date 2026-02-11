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
    variant?: "default" | "compact";
    className?: string;
}

/**
 * Tag visual para exibir o nome comercial da instância WhatsApp
 * Usa: <InstanceTag instanceName={conversation.instance_friendly_name} />
 */
export function InstanceTag({ instanceName, variant = "default", className = "" }: InstanceTagProps) {
    if (!instanceName) return null;

    const isCompact = variant === "compact";

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={`
              ${isCompact ? 'text-[9px] px-1.5 py-0 h-4' : 'text-[10px] px-2 py-0.5 h-5'} 
              bg-gradient-to-r from-blue-500/10 to-indigo-500/10 
              border-blue-500/30 
              text-blue-400 
              hover:bg-blue-500/20 
              transition-all 
              font-medium 
              uppercase 
              tracking-wider
              flex 
              items-center 
              gap-1
              ${className}
            `}
                    >
                        <Smartphone className={`${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                        <span className="truncate max-w-[80px]">{instanceName}</span>
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
