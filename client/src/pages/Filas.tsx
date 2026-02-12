import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

interface QueueItem {
  id: number;
  companyId: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

const FilasPage = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [newQueueName, setNewQueueName] = useState("");
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

  const handleCreateQueue = async () => {
    if (!isAdmin) return;
    const name = newQueueName.trim();
    if (!name) {
      toast.error("Informe o nome da fila");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Falha ao criar fila");
      }

      setNewQueueName("");
      toast.success("Fila criada com sucesso");
      loadQueues();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar fila");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Filas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as filas de atendimento da sua empresa.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fila de Atendimento</CardTitle>
          <CardDescription>As conversas podem ser direcionadas automaticamente para uma fila.</CardDescription>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              placeholder="Nome da nova fila"
              value={newQueueName}
              onChange={(e) => setNewQueueName(e.target.value)}
              disabled={!isAdmin || isSaving}
            />
            <Button onClick={handleCreateQueue} disabled={!isAdmin || isSaving} className="gap-2">
              <Plus className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Nova Fila"}
            </Button>
          </div>

          <div className="relative mt-1">
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
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-3 font-semibold">Nome</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">
                        <Badge variant={item.isActive ? "default" : "secondary"}>
                          {item.isActive ? "Ativa" : "Inativa"}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FilasPage;
