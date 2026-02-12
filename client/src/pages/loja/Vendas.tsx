
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Search, Filter } from 'lucide-react';
import { CreateSaleDialog } from '../../components/shop-dashboard/CreateSaleDialog';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Badge } from '../../components/ui/badge';

interface Sale {
    id: number;
    client_name: string;
    final_amount: string | number;
    payment_method: string;
    status: string;
    created_at: string;
    items_count?: number; // derived if joined? controller returns count? no, just s.* and client_name
}

export default function VendasLojaPage() {
    const { token, user } = useAuth();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
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
            console.error("Failed to fetch instance", e);
        }
    };

    const fetchSales = async () => {
        if (!instanceId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/shop/sales?limit=100&instance_id=${instanceId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                }
            });
            if (res.ok) {
                const data = await res.json();
                setSales(data);
            }
        } catch (e) {
            console.error("Failed to fetch sales", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token && user?.company_id) fetchInstance();
    }, [token, user?.company_id]);

    useEffect(() => {
        if (token && instanceId) fetchSales();
    }, [token, instanceId]);

    const formatCurrency = (val: string | number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pt-BR');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <Badge className="bg-green-500">Concluída</Badge>;
            case 'pending': return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendente</Badge>;
            case 'cancelled': return <Badge variant="destructive">Cancelada</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Vendas</h1>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nova Venda
                </Button>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar vendas..." className="pl-8" />
                </div>
                <Button variant="outline"><Filter className="h-4 w-4 mr-2" /> Filtros</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Vendas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Valor Total</TableHead>
                                    <TableHead>Pagamento</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell>
                                    </TableRow>
                                ) : sales.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Nenhuma venda encontrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sales.map((sale) => (
                                        <TableRow key={sale.id}>
                                            <TableCell className="font-mono">#{sale.id}</TableCell>
                                            <TableCell>{formatDate(sale.created_at)}</TableCell>
                                            <TableCell>{sale.client_name || 'Cliente Balcão'}</TableCell>
                                            <TableCell className="font-bold">{formatCurrency(sale.final_amount)}</TableCell>
                                            <TableCell className="capitalize">{sale.payment_method?.replace('_', ' ') || '-'}</TableCell>
                                            <TableCell>{getStatusBadge(sale.status)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <CreateSaleDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={fetchSales}
            />
        </div>
    );
}
