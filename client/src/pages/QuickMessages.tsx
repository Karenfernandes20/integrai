import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

type QuickMessageType = "text" | "image" | "audio" | "document";

interface QuickMessage {
    id: number;
    key: string;
    type: QuickMessageType;
    content: string;
    fileName?: string | null;
    createdAt: string;
    updatedAt: string;
}

const TYPE_LABEL: Record<QuickMessageType, string> = {
    text: "Texto",
    image: "Imagem",
    audio: "Áudio",
    document: "Documento",
};

const normalizeKey = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9_-]/g, "");

const QuickMessagesPage = () => {
    const { token, user } = useAuth();
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

    const [items, setItems] = useState<QuickMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [query, setQuery] = useState("");

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<QuickMessage | null>(null);
    const [formKey, setFormKey] = useState("");
    const [formType, setFormType] = useState<QuickMessageType>("text");
    const [formContent, setFormContent] = useState("");
    const [formFile, setFormFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((i) => i.key.toLowerCase().includes(q) || i.content.toLowerCase().includes(q));
    }, [items, query]);

    const fetchItems = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch("/api/quick-messages", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Falha ao buscar mensagens rápidas");
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (error: any) {
            toast.error(error?.message || "Erro ao carregar mensagens rápidas");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [token]);

    const openCreate = () => {
        setEditing(null);
        setFormKey("");
        setFormType("text");
        setFormContent("");
        setFormFile(null);
        setOpen(true);
    };

    const openEdit = (item: QuickMessage) => {
        setEditing(item);
        setFormKey(item.key);
        setFormType(item.type);
        setFormContent(item.type === "text" ? item.content : "");
        setFormFile(null);
        setOpen(true);
    };

    const handleSave = async () => {
        if (!isAdmin) return;
        const cleanedKey = normalizeKey(formKey);
        if (!cleanedKey) return toast.error("Informe uma chave válida sem espaço/acentos");
        if (formType === "text" && !formContent.trim()) return toast.error("Informe o conteúdo da mensagem");
        if (formType !== "text" && !editing && !formFile && !formContent.trim()) {
            return toast.error("Envie um arquivo ou URL para mídia");
        }

        setIsSaving(true);
        try {
            const payload = new FormData();
            payload.append("key", cleanedKey);
            payload.append("type", formType);
            if (formContent.trim()) payload.append("content", formContent.trim());
            if (formFile) payload.append("file", formFile);

            const url = editing ? `/api/quick-messages/${editing.id}` : "/api/quick-messages";
            const method = editing ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token}` },
                body: payload,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || "Falha ao salvar");
            }

            toast.success(editing ? "Mensagem rápida atualizada" : "Mensagem rápida criada");
            setOpen(false);
            fetchItems();
        } catch (error: any) {
            toast.error(error?.message || "Erro ao salvar");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!isAdmin) return;
        if (!window.confirm("Deseja excluir esta mensagem rápida?")) return;
        try {
            const res = await fetch(`/api/quick-messages/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Falha ao excluir");
            toast.success("Mensagem rápida excluída");
            fetchItems();
        } catch (error: any) {
            toast.error(error?.message || "Erro ao excluir");
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Mensagens Rápidas</h1>
                    <p className="text-sm text-muted-foreground">Use atalhos com <span className="font-mono">/chave</span> dentro do Atendimento.</p>
                </div>
                {isAdmin && (
                    <Button onClick={openCreate} className="gap-2">
                        <Plus className="h-4 w-4" /> Nova Mensagem Rápida
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Biblioteca</CardTitle>
                    <CardDescription>Mensagens por empresa, compartilhadas com a equipe.</CardDescription>
                    <div className="relative mt-2">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por chave ou conteúdo" className="pl-9" />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-sm text-muted-foreground">Carregando...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Nenhuma mensagem rápida cadastrada.</div>
                    ) : (
                        <div className="overflow-auto rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="text-left p-3 font-semibold">Chave</th>
                                        <th className="text-left p-3 font-semibold">Tipo</th>
                                        <th className="text-left p-3 font-semibold">Prévia</th>
                                        <th className="text-right p-3 font-semibold">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((item) => (
                                        <tr key={item.id} className="border-t">
                                            <td className="p-3 font-mono">/{item.key}</td>
                                            <td className="p-3"><Badge variant="secondary">{TYPE_LABEL[item.type]}</Badge></td>
                                            <td className="p-3 text-muted-foreground max-w-[520px] truncate">
                                                {item.type === "text" ? item.content : (item.fileName || item.content)}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isAdmin && (
                                                        <>
                                                            <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Mensagem Rápida" : "Nova Mensagem Rápida"}</DialogTitle>
                        <DialogDescription>Defina uma chave única e o conteúdo que será sugerido ao digitar /.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Chave</label>
                            <Input
                                value={formKey}
                                onChange={(e) => setFormKey(normalizeKey(e.target.value))}
                                placeholder="ex: endereco, pagamento, horario"
                                disabled={!isAdmin}
                            />
                            <p className="text-xs text-muted-foreground">Sem espaços/acentos. Exemplo de uso: <span className="font-mono">/{formKey || "endereco"}</span></p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipo</label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={formType}
                                onChange={(e) => setFormType(e.target.value as QuickMessageType)}
                                disabled={!isAdmin}
                            >
                                <option value="text">Texto</option>
                                <option value="image">Imagem</option>
                                <option value="audio">Áudio</option>
                                <option value="document">Documento</option>
                            </select>
                        </div>

                        {formType === "text" ? (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Conteúdo</label>
                                <Textarea
                                    value={formContent}
                                    onChange={(e) => setFormContent(e.target.value)}
                                    rows={6}
                                    placeholder="Mensagem de texto..."
                                    disabled={!isAdmin}
                                />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Upload do arquivo</label>
                                    <Input
                                        type="file"
                                        onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                                        disabled={!isAdmin}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ou URL da mídia</label>
                                    <Input
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        placeholder="https://..."
                                        disabled={!isAdmin}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                            {isAdmin && <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</Button>}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default QuickMessagesPage;
