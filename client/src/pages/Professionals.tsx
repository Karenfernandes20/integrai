
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/use-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Trash2, Edit, Plus, UserPlus } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';

interface Professional {
    id: number;
    name: string;
    specialty: string;
    phone: string;
    email: string;
    active: boolean;
    color: string;
}

const ProfessionalsPage = () => {
    const { token } = useAuth();
    const { toast } = useToast();
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        specialty: '',
        phone: '',
        email: '',
        active: true,
        color: '#3b82f6'
    });

    const fetchProfessionals = async () => {
        try {
            const res = await fetch('/api/crm/professionals', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProfessionals(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchProfessionals();
    }, [token]);

    const handleSubmit = async () => {
        if (!formData.name) return toast({ title: "Nome obrigatório", variant: "destructive" });
        setIsLoading(true);
        try {
            const url = editingId ? `/api/crm/professionals/${editingId}` : '/api/crm/professionals';
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast({ title: "Sucesso!", description: "Profissional salvo." });
                setIsDialogOpen(false);
                fetchProfessionals();
                setFormData({ name: '', specialty: '', phone: '', email: '', active: true, color: '#3b82f6' });
                setEditingId(null);
            } else {
                toast({ title: "Erro", description: "Falha ao salvar.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Erro", description: "Erro de conexão", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (p: Professional) => {
        setFormData({
            name: p.name,
            specialty: p.specialty || '',
            phone: p.phone || '',
            email: p.email || '',
            active: p.active,
            color: p.color || '#3b82f6'
        });
        setEditingId(p.id);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir?")) return;
        try {
            const res = await fetch(`/api/crm/professionals/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast({ title: "Excluído", description: "Profissional removido." });
                fetchProfessionals();
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Profissionais</h1>
                    <p className="text-muted-foreground">Gerencie a equipe médica e especialistas da clínica.</p>
                </div>
                <Button onClick={() => {
                    setEditingId(null);
                    setFormData({ name: '', specialty: '', phone: '', email: '', active: true, color: '#3b82f6' });
                    setIsDialogOpen(true);
                }}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Novo Profissional
                </Button>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cor</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Especialidade</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {professionals.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    Nenhum profissional cadastrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            professionals.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="w-6 h-6 rounded-full border shadow-sm" style={{ backgroundColor: p.color }} />
                                    </TableCell>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell>{p.specialty || '-'}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-xs space-y-1">
                                            {p.phone && <span>{p.phone}</span>}
                                            {p.email && <span className="text-muted-foreground">{p.email}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={p.active ? 'default' : 'secondary'} className={!p.active ? 'opacity-50' : ''}>
                                            {p.active ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(p.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome Completo *</Label>
                            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Especialidade</Label>
                                <Input
                                    placeholder="Ex: Cardiologista"
                                    value={formData.specialty}
                                    onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefone</Label>
                                <Input
                                    placeholder="(00) 00000-0000"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-2">
                                <Label>Cor na Agenda</Label>
                                <div className="flex gap-2 mt-1">
                                    {['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#64748b'].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            className={`w-6 h-6 rounded-full border ${formData.color === c ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setFormData({ ...formData, color: c })}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label>Ativo</Label>
                                <Switch checked={formData.active} onCheckedChange={checked => setFormData({ ...formData, active: checked })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProfessionalsPage;
