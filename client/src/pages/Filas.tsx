import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface QueueItem {
  id: number;
  companyId: number;
  name: string;
  isActive: boolean;
  greetingMessage?: string | null;
  color?: string;
  createdAt: string;
}

const FilasPage = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QueueItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formGreeting, setFormGreeting] = useState("");
  const [formColor, setFormColor] = useState("#3b82f6");
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  const loadQueues = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/queues", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar filas");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar filas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueues();
  }, [token]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormGreeting("");
    setFormColor("#3b82f6");
    setFormIsActive(true);
    setOpen(true);
  };

  const openEdit = (item: QueueItem) => {
    setEditing(item);
    setFormName(item.name);
    setFormGreeting(item.greetingMessage || "");
    setFormColor(item.color || "#3b82f6");
    setFormIsActive(item.isActive);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    const name = formName.trim();
    if (!name) return toast.error("Informe o nome da fila");

    setIsSaving(true);
    try {
      const url = editing ? `/api/queues/${editing.id}` : "/api/queues";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          greetingMessage: formGreeting,
          color: formColor,
          isActive: formIsActive
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Falha ao salvar fila");
      }

      toast.success(editing ? "Fila atualizada" : "Fila criada");
      setOpen(false);
      loadQueues();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar fila");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return;
    if (!window.confirm("Deseja excluir esta fila? Todas as conversas vinculadas ficarão sem fila.")) return;

    try {
      const res = await fetch(`/api/queues/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao excluir");
      toast.success("Fila excluída");
      loadQueues();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao excluir");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Filas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as filas de atendimento da sua empresa.</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Fila
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filas de Atendimento</CardTitle>
          <CardDescription>Departamentos para onde as conversas são direcionadas.</CardDescription>

          <div className="relative mt-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar fila"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando filas...</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fila cadastrada.</p>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 font-medium">
                  <tr>
                    <th className="text-left p-3">Cor</th>
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Saudação</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: item.color || '#3b82f6' }} />
                      </td>
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3 truncate max-w-[300px] text-muted-foreground italic">
                        {item.greetingMessage || "Sem saudação configurada"}
                      </td>
                      <td className="p-3">
                        <Badge variant={item.isActive ? "default" : "secondary"}>
                          {item.isActive ? "Ativa" : "Inativa"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Fila" : "Nova Fila"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Fila</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Comercial, Suporte" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cor</label>
                <div className="flex gap-2">
                  <Input type="color" value={formColor} onChange={(e) => setFormColor(e.target.value)} className="w-12 h-10 p-1" />
                  <Input value={formColor} onChange={(e) => setFormColor(e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Saudação Automática</label>
              <Textarea
                value={formGreeting}
                onChange={(e) => setFormGreeting(e.target.value)}
                placeholder="Exulado: Olá! Aguarde um momento que um de nossos atendentes irá te ajudar."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">Esta mensagem será enviada automaticamente quando o contato entrar na fila.</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="active" className="text-sm">Fila Ativa</label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default FilasPage;
