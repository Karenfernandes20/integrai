import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type ReasonType = "positivo" | "negativo" | "neutro";

interface ClosingReason {
  id: number;
  name: string;
  category: string | null;
  type: ReasonType;
  isActive: boolean;
}

const CATEGORIES = ["Venda", "Não interessado", "Suporte resolvido", "Cancelamento", "Orçamento", "Outros"];

const typeBadge = (type: ReasonType) => {
  if (type === "positivo") return "bg-emerald-100 text-emerald-700";
  if (type === "negativo") return "bg-rose-100 text-rose-700";
  return "bg-blue-100 text-blue-700";
};

export default function ClosingReasonsPage() {
  const { token } = useAuth();
  const [reasons, setReasons] = useState<ClosingReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClosingReason | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "Outros",
    type: "neutro" as ReasonType,
    isActive: true
  });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/closing-reasons?onlyActive=false", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Falha ao carregar motivos");
      const data = await res.json();
      setReasons(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar motivos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", category: "Outros", type: "neutro", isActive: true });
    setOpen(true);
  };

  const openEdit = (r: ClosingReason) => {
    setEditing(r);
    setForm({
      name: r.name,
      category: r.category || "Outros",
      type: r.type,
      isActive: r.isActive
    });
    setOpen(true);
  };

  const save = async () => {
    if (!token) return;
    if (!form.name.trim()) {
      toast.error("Nome do motivo é obrigatório");
      return;
    }
    try {
      const url = editing ? `/api/closing-reasons/${editing.id}` : "/api/closing-reasons";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category || "Outros",
          type: form.type,
          isActive: form.isActive
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao salvar");
      toast.success(editing ? "Motivo atualizado" : "Motivo criado");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  const remove = async (id: number) => {
    if (!token) return;
    if (!window.confirm("Deseja desativar este motivo?")) return;
    try {
      const res = await fetch(`/api/closing-reasons/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Falha ao excluir");
      toast.success("Motivo desativado");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Motivos de Encerramento</h1>
          <p className="text-sm text-muted-foreground">Cadastre os motivos usados no encerramento dos atendimentos.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Motivo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Motivos</CardTitle>
          <CardDescription>Esses motivos serão obrigatórios ao encerrar atendimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-3 font-semibold">Motivo</th>
                  <th className="text-left p-3 font-semibold">Categoria</th>
                  <th className="text-left p-3 font-semibold">Tipo</th>
                  <th className="text-left p-3 font-semibold">Ativo</th>
                  <th className="text-right p-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
                ) : reasons.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum motivo cadastrado.</td></tr>
                ) : reasons.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">{r.category || "Outros"}</td>
                    <td className="p-3">
                      <Badge className={typeBadge(r.type)}>{r.type}</Badge>
                    </td>
                    <td className="p-3">{r.isActive ? "Ativo" : "Inativo"}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar motivo" : "Novo motivo"}</DialogTitle>
            <DialogDescription>Defina nome, categoria, tipo e status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome do motivo"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.type} onValueChange={(v: ReasonType) => setForm((p) => ({ ...p, type: v }))}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="positivo">Positivo</SelectItem>
                <SelectItem value="negativo">Negativo</SelectItem>
                <SelectItem value="neutro">Neutro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.isActive ? "true" : "false"} onValueChange={(v) => setForm((p) => ({ ...p, isActive: v === "true" }))}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Ativo</SelectItem>
                <SelectItem value="false">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
