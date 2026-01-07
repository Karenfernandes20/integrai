import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Plus, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

interface CostCenter {
    id: number;
    name: string;
}

interface ManageCostCentersDialogProps {
    isOpen: boolean;
    onClose: () => void;
    costCenters: CostCenter[];
    onRefresh: () => void;
    token: string | null;
}

export function ManageCostCentersDialog({
    isOpen,
    onClose,
    costCenters,
    onRefresh,
    token
}: ManageCostCentersDialogProps) {
    const [newCostCenterName, setNewCostCenterName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleAdd = async () => {
        if (!newCostCenterName.trim()) {
            toast.error("Digite um nome para o centro de custo");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch("/api/financial/cost-centers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name: newCostCenterName.trim() })
            });

            if (res.ok) {
                toast.success("Centro de custo adicionado!");
                setNewCostCenterName("");
                onRefresh();
            } else {
                const error = await res.json();
                toast.error(error.error || "Erro ao adicionar centro de custo");
            }
        } catch (error) {
            toast.error("Erro de conexão");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja realmente excluir este centro de custo?")) return;

        try {
            const res = await fetch(`/api/financial/cost-centers/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success("Centro de custo excluído!");
                onRefresh();
            } else {
                const error = await res.json();
                toast.error(error.error || "Erro ao excluir");
            }
        } catch (error) {
            toast.error("Erro de conexão");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-[#008069]" />
                        Gerenciar Centros de Custo
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Add New */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Nome do centro de custo..."
                            value={newCostCenterName}
                            onChange={(e) => setNewCostCenterName(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleAdd()}
                            disabled={isLoading}
                        />
                        <Button
                            onClick={handleAdd}
                            disabled={isLoading}
                            className="bg-[#008069] hover:bg-[#006654]"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* List */}
                    <ScrollArea className="h-[300px] pr-4">
                        {costCenters.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                Nenhum centro de custo cadastrado
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {costCenters.map((cc) => (
                                    <div
                                        key={cc.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                                    >
                                        <span className="font-medium">{cc.name}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(cc.id)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
