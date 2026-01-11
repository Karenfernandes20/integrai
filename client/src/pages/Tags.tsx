
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Tags as TagsIcon, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";

interface Tag {
    id: number;
    name: string;
    color: string;
}

export default function Tags() {
    const { token } = useAuth();
    const [tags, setTags] = useState<Tag[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [formData, setFormData] = useState({ name: "", color: "#cbd5e1" });

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        try {
            const response = await fetch("/api/crm/tags", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setTags(data);
            }
        } catch (error) {
            console.error("Error fetching tags:", error);
            toast.error("Erro ao carregar tags");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;

        try {
            const url = editingTag ? `/api/crm/tags/${editingTag.id}` : "/api/crm/tags";
            const method = editingTag ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                toast.success(editingTag ? "Tag atualizada!" : "Tag criada!");
                fetchTags();
                handleCloseDialog();
            } else {
                toast.error("Erro ao salvar tag");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar tag");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir esta tag?")) return;

        try {
            const response = await fetch(`/api/crm/tags/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                toast.success("Tag excluída!");
                setTags(tags.filter(t => t.id !== id));
            } else {
                toast.error("Erro ao excluir tag");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao excluir tag");
        }
    };

    const handleOpenDialog = (tag?: Tag) => {
        if (tag) {
            setEditingTag(tag);
            setFormData({ name: tag.name, color: tag.color });
        } else {
            setEditingTag(null);
            setFormData({ name: "", color: "#cbd5e1" });
        }
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingTag(null);
        setFormData({ name: "", color: "#cbd5e1" });
    };

    const filteredTags = tags.filter(tag =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const colors = [
        "#cbd5e1", // slate-300
        "#ef4444", // red-500
        "#f97316", // orange-500
        "#f59e0b", // amber-500
        "#84cc16", // lime-500
        "#10b981", // emerald-500
        "#06b6d4", // cyan-500
        "#3b82f6", // blue-500
        "#6366f1", // indigo-500
        "#8b5cf6", // violet-500
        "#d946ef", // fuchsia-500
        "#f43f5e", // rose-500
    ];

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Gerenciamento de Tags</h1>
                    <p className="text-muted-foreground mt-1">Crie e organize etiquetas para classificar seus leads no CRM.</p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="bg-[#008069] hover:bg-[#006654]">
                    <Plus className="mr-2 h-4 w-4" /> Nova Tag
                </Button>
            </div>

            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                <CardHeader className="pb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar tags..."
                            className="pl-9 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008069]"></div>
                        </div>
                    ) : filteredTags.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <TagsIcon className="mx-auto h-12 w-12 opacity-20 mb-4" />
                            <p>Nenhuma tag encontrada.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTags.map((tag) => (
                                <div
                                    key={tag.id}
                                    className="group flex items-center justify-between p-4 rounded-lg border bg-white hover:shadow-md transition-all duration-200"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-4 w-4 rounded-full border shadow-sm"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <span className="font-medium text-gray-700">{tag.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={() => handleOpenDialog(tag)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(tag.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome da Tag</Label>
                            <Input
                                placeholder="Ex: Cliente VIP, Interessado, etc."
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Cor</Label>
                            <div className="flex flex-wrap gap-2">
                                {colors.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setFormData({ ...formData, color: c })}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
                        <Button className="bg-[#008069] hover:bg-[#006654]" onClick={handleSave}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
