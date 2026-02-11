import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';

interface QueueItem {
  id: number;
  name: string;
  color: string;
  is_active: boolean;
}

interface Props {
  companyId: number;
  token: string | null;
}

const defaultForm = {
  name: '',
  color: '#3B82F6',
  is_active: true,
};

export function CompanyQueueManager({ companyId, token }: Props) {
  const { toast } = useToast();
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState<QueueItem | null>(null);
  const [form, setForm] = useState(defaultForm);

  const activeCount = useMemo(() => queues.filter(q => q.is_active).length, [queues]);

  const loadQueues = async () => {
    if (!token || !companyId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/queues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Falha ao carregar filas');
      const data = await res.json();
      setQueues(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueues();
  }, [companyId, token]);

  const openNew = () => {
    setEditing(null);
    setForm(defaultForm);
    setIsOpen(true);
  };

  const openEdit = (queue: QueueItem) => {
    setEditing(queue);
    setForm({ name: queue.name, color: queue.color, is_active: queue.is_active });
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validação', description: 'Nome da fila é obrigatório.', variant: 'destructive' });
      return;
    }

    try {
      const url = editing
        ? `/api/companies/${companyId}/queues/${editing.id}`
        : `/api/companies/${companyId}/queues`;
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar fila');

      toast({ title: 'Sucesso', description: editing ? 'Fila atualizada.' : 'Fila criada.' });
      setIsOpen(false);
      await loadQueues();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Filas</h4>
          <p className="text-xs text-slate-500">{activeCount} ativas de {queues.length} total</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={openNew}>+ Nova Fila</Button>
      </div>

      <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
        {isLoading ? (
          <p className="text-xs text-slate-500">Carregando filas...</p>
        ) : queues.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma fila cadastrada para esta empresa.</p>
        ) : (
          queues.map(queue => (
            <div key={queue.id} className="flex items-center justify-between rounded-md border bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: queue.color }} />
                <span className="text-sm font-medium">{queue.name}</span>
                <Badge variant={queue.is_active ? 'default' : 'secondary'}>{queue.is_active ? 'Ativa' : 'Inativa'}</Badge>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(queue)}>Editar</Button>
            </div>
          ))
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Fila' : 'Nova Fila'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nome</label>
              <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Cor</label>
              <Input type="color" value={form.color} onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))} className="h-10 w-20 p-1" />
            </div>

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={form.is_active} onChange={() => setForm(prev => ({ ...prev, is_active: true }))} /> Ativa
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!form.is_active} onChange={() => setForm(prev => ({ ...prev, is_active: false }))} /> Inativa
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
