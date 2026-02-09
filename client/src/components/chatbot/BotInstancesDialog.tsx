
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, QrCode } from 'lucide-react';

interface BotInstancesDialogProps {
    botId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface Instance {
    instance_key: string;
    instance_friendly_name: string;
    is_connected: boolean;
}

export const BotInstancesDialog: React.FC<BotInstancesDialogProps> = ({ botId, open, onOpenChange }) => {
    const { token } = useAuth();
    const { toast } = useToast();
    const [instances, setInstances] = useState<Instance[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open && botId) {
            fetchInstances();
        }
    }, [open, botId]);

    const fetchInstances = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/bots/${botId}/instances`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setInstances(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = async (instanceKey: string, currentStatus: boolean) => {
        // Optimistic update
        setInstances(prev => prev.map(i =>
            i.instance_key === instanceKey ? { ...i, is_connected: !currentStatus } : i
        ));

        try {
            const res = await fetch(`/api/bots/${botId}/instances`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    instance_key: instanceKey,
                    active: !currentStatus
                })
            });

            if (!res.ok) throw new Error();
        } catch (error) {
            // Revert on error
            setInstances(prev => prev.map(i =>
                i.instance_key === instanceKey ? { ...i, is_connected: currentStatus } : i
            ));
            toast({ title: "Erro", description: "Falha ao atualizar conexão", variant: "destructive" });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Conectar Instâncias</DialogTitle>
                    <DialogDescription>
                        Escolha quais números de WhatsApp utilizarão este bot.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {isLoading ? (
                        <div className="text-center text-sm text-slate-500">Carregando instâncias...</div>
                    ) : instances.length === 0 ? (
                        <div className="text-center p-4 bg-slate-50 rounded text-slate-500">
                            Nenhuma instância conectada ao sistema.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {instances.map(instance => (
                                <div key={instance.instance_key} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 rounded text-slate-600">
                                            <Smartphone size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{instance.instance_friendly_name}</p>
                                            <p className="text-xs text-slate-500 font-mono">
                                                {instance.instance_key.substring(0, 15)}...
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium ${instance.is_connected ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {instance.is_connected ? 'Ativo' : 'Inativo'}
                                        </span>
                                        <Switch
                                            checked={instance.is_connected}
                                            onCheckedChange={() => handleToggle(instance.instance_key, instance.is_connected)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
