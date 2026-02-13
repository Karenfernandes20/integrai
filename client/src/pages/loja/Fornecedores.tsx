
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Plus, Search, Mail, Phone, Building2, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CreateSupplierDrawer } from '../../components/shop-dashboard/CreateSupplierDrawer';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";

interface Supplier {
    id: number;
    name: string;
    contact_name?: string;
    phone?: string;
    email?: string;
    cnpj?: string;
}

export default function FornecedoresPage() {
    const { token, user } = useAuth();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [instanceId, setInstanceId] = useState<number | null>(null);

    const fetchInstance = async () => {
        if (!token || !user?.company_id) return;
        try {
            const res = await fetch(`/api/companies/${user.company_id}/instances`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const instances = await res.json();
                if (Array.isArray(instances) && instances.length > 0) {
                    const connected = instances.find((i: any) => i.status === 'open' || i.status === 'connected');
                    setInstanceId(Number((connected || instances[0]).id));
                }
            }
        } catch (e) {
            console.error("Failed to fetch company instances", e);
        }
    };

    const fetchSuppliers = async () => {
        if (!instanceId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/shop/suppliers`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                }
            });
            if (res.ok) {
                const data = await res.json();
                setSuppliers(data);
            }
        } catch (e) {
            console.error("Failed to fetch suppliers", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInstance();
    }, [token, user?.company_id]);

    useEffect(() => {
        if (instanceId) fetchSuppliers();
    }, [instanceId]);

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.cnpj?.includes(searchTerm)
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Fornecedores</h1>
                <Button onClick={() => setIsDrawerOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
                </Button>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, contato ou CNPJ..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
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
                                    <TableHead>Email</TableHead>
                                    <TableHead>CNPJ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell>
                                    </TableRow>
                                ) : filteredSuppliers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                            Nenhum fornecedor encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSuppliers.map((supplier) => (
                                        <TableRow key={supplier.id}>
                                            <TableCell className="font-medium">{supplier.name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    {supplier.contact_name || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                                    {supplier.phone || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                                    {supplier.email || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{supplier.cnpj || '-'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <CreateSupplierDrawer
                open={isDrawerOpen}
                onOpenChange={setIsDrawerOpen}
                onSuccess={fetchSuppliers}
                instanceId={instanceId}
            />
        </div>
    );
}
