import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Truck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { toast } from '../../components/ui/use-toast';

interface Supplier {
    id: number;
    name: string;
    contact_name?: string;
    phone?: string;
    email?: string;
    cnpj?: string;
}

const INITIAL_FORM = {
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    cnpj: '',
};

export default function FornecedoresPage() {
    const { token } = useAuth();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState(INITIAL_FORM);

    const fetchSuppliers = async () => {
        if (!token) return;

        setLoading(true);
        try {
            const res = await fetch('/api/shop/suppliers', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                throw new Error('Erro ao carregar fornecedores');
            }

            const data = await res.json();
            setSuppliers(Array.isArray(data) ? data : []);
        } catch (error) {
            toast({
                title: 'Erro ao carregar fornecedores',
                description: 'Não foi possível buscar a lista de fornecedores.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, [token]);

    const resetForm = () => {
        setFormData(INITIAL_FORM);
    };

    const handleSaveSupplier = async () => {
        if (!formData.name.trim()) {
            toast({
                title: 'Validação',
                description: 'Informe o nome do fornecedor.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/shop/suppliers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err?.error || 'Erro ao cadastrar fornecedor');
            }

            toast({ title: 'Fornecedor cadastrado com sucesso!' });
            setIsDialogOpen(false);
            resetForm();
            fetchSuppliers();
        } catch (error: any) {
            toast({
                title: 'Erro ao cadastrar fornecedor',
                description: error?.message || 'Falha inesperada.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Fornecedores</h1>
                <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Lista de Fornecedores</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fornecedor</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead>Telefone</TableHead>
                                    <TableHead>E-mail</TableHead>
                                    <TableHead>CNPJ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">Carregando fornecedores...</TableCell>
                                    </TableRow>
                                ) : suppliers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Truck className="h-10 w-10 opacity-50" />
                                                Nenhum fornecedor cadastrado.
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    suppliers.map((supplier) => (
                                        <TableRow key={supplier.id}>
                                            <TableCell className="font-medium">{supplier.name}</TableCell>
                                            <TableCell>{supplier.contact_name || '-'}</TableCell>
                                            <TableCell>{supplier.phone || '-'}</TableCell>
                                            <TableCell>{supplier.email || '-'}</TableCell>
                                            <TableCell>{supplier.cnpj || '-'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Novo Fornecedor</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                        <div className="md:col-span-2 space-y-2">
                            <Label>Nome *</Label>
                            <Input
                                placeholder="Ex: Distribuidora ABC"
                                value={formData.name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Contato</Label>
                            <Input
                                placeholder="Ex: João Silva"
                                value={formData.contact_name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, contact_name: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input
                                placeholder="(11) 99999-9999"
                                value={formData.phone}
                                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input
                                type="email"
                                placeholder="contato@fornecedor.com"
                                value={formData.email}
                                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>CNPJ</Label>
                            <Input
                                placeholder="00.000.000/0001-00"
                                value={formData.cnpj}
                                onChange={(e) => setFormData((prev) => ({ ...prev, cnpj: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setIsDialogOpen(false);
                                resetForm();
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveSupplier} disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'Salvar fornecedor'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
