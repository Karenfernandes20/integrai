
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Plus, Search, Filter, AlertTriangle, Package, Edit } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CreateProductDrawer } from '../../components/shop-dashboard/CreateProductDrawer';
import { EditProductDrawer } from '../../components/shop-dashboard/EditProductDrawer';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';

interface Product {
    id: number;
    name: string;
    sku: string;
    category: string;
    sale_price: string | number;
    quantity: string | number;
    min_quantity: string | number;
    status: string;
    supplier_name?: string;
    location?: string;
}

export default function EstoquePage() {
    const { token, user } = useAuth();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [instanceId, setInstanceId] = useState<number | null>(null);
    const [instanceLoading, setInstanceLoading] = useState(true);

    const fetchInstance = async () => {
        if (!token || !user?.company_id) return;
        try {
            setInstanceLoading(true);
            const res = await fetch(`/api/companies/${user.company_id}/instances`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                setInstanceId(null);
                return;
            }
            const instances = await res.json();
            if (!Array.isArray(instances) || instances.length === 0) {
                setInstanceId(null);
                return;
            }
            const connected = instances.find((i: any) => i.status === 'open' || i.status === 'connected');
            setInstanceId(Number((connected || instances[0]).id));
        } catch (e) {
            console.error("Failed to fetch company instances", e);
            setInstanceId(null);
        } finally {
            setInstanceLoading(false);
        }
    };

    const fetchProducts = async () => {
        if (!instanceId) return;
        setLoading(true);
        try {
            const query = new URLSearchParams();
            query.set('instance_id', String(instanceId));
            if (searchTerm) query.set('search', searchTerm);
            const res = await fetch(`/api/shop/inventory?${query.toString()}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                }
            });
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (e) {
            console.error("Failed to fetch inventory", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token && user?.company_id) fetchInstance();
    }, [token, user?.company_id]);

    useEffect(() => {
        if (token && instanceId) fetchProducts();
    }, [token, searchTerm, instanceId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                setIsDrawerOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleRowClick = (product: Product) => {
        setSelectedProduct(product);
        setIsEditDrawerOpen(true);
    };

    const formatCurrency = (val: string | number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
    };

    const getStatusBadge = (status: string, qty: number, minQty: number) => {
        if (qty <= minQty) return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Baixo Estoque</Badge>;
        if (status === 'active') return <Badge className="bg-green-600">Ativo</Badge>;
        return <Badge variant="secondary">Inativo</Badge>;
    };

    const isHealthMode = user?.company?.operation_type === 'pacientes' || user?.company?.operational_profile === 'CLINICA' || user?.company?.category === 'clinica';

    if (instanceLoading) {
        return <div className="p-8 text-center text-muted-foreground">Buscando instância...</div>;
    }

    if (!instanceId) {
        return <div className="p-8 text-center text-red-500">Nenhuma instância encontrada para esta empresa.</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">{isHealthMode ? 'Insumos / Clínica' : 'Estoque'}</h1>
                <Button onClick={() => setIsDrawerOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> {isHealthMode ? 'Novo Insumo' : 'Novo Produto'}
                </Button>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={isHealthMode ? "Buscar por insumo, lote ou categoria..." : "Buscar por nome, SKU ou categoria..."}
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline"><Filter className="h-4 w-4 mr-2" /> Filtros</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{isHealthMode ? 'Insumos Cadastrados' : 'Produtos Cadastrados'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px] whitespace-nowrap">SKU</TableHead>
                                    <TableHead>{isHealthMode ? 'Insumo' : 'Produto'}</TableHead>
                                    {isHealthMode && <TableHead>Lote</TableHead>}
                                    {isHealthMode && <TableHead>Validade</TableHead>}
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>{isHealthMode ? 'Custo' : 'Preço Venda'}</TableHead>
                                    <TableHead className="text-center">{isHealthMode ? 'Qtd' : 'Estoque'}</TableHead>
                                    <TableHead>Local</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && (
                                    <TableRow>
                                        <TableCell colSpan={isHealthMode ? 9 : 7} className="text-center py-8">Carregando...</TableCell>
                                    </TableRow>
                                ) : products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isHealthMode ? 9 : 7} className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center h-40 break-normal whitespace-normal">
                                        <TableCell colSpan={10} className="text-center py-8">Carregando...</TableCell>
                                    </TableRow>
                                )}

                                {!loading && products.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                                            <div className="flex h-40 flex-col items-center justify-center">
                                                <Package className="mb-2 h-10 w-10 opacity-50" />
                                                Nenhum produto encontrado.
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap break-normal">{product.sku}</TableCell>
                                        <TableRow
                                            key={product.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => handleRowClick(product)}
                                        >
                                            <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            {isHealthMode && <TableCell className="text-xs font-mono">{(product as any).batch_number || '-'}</TableCell>}
                                            {isHealthMode && (
                                                <TableCell className="text-xs">
                                                    {(product as any).expiration_date ? (
                                                        <span className={cn(
                                                            new Date((product as any).expiration_date) < new Date() ? "text-red-500 font-bold" :
                                                                new Date((product as any).expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? "text-amber-500 font-medium" : ""
                                                        )}>
                                                            {new Date((product as any).expiration_date).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    ) : '-'}
                                                </TableCell>
                                            )}
                                            <TableCell>{product.category || '-'}</TableCell>
                                            <TableCell>{isHealthMode ? formatCurrency((product as any).cost_price || 0) : formatCurrency(product.sale_price)}</TableCell>
                                            <TableCell className="text-center font-bold">{Number(product.quantity)}</TableCell>
                                            <TableCell className="text-xs">{product.location || '-'}</TableCell>
                                            <TableCell>{getStatusBadge(product.status, Number(product.quantity), Number(product.min_quantity))}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRowClick(product);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}

                                {!loading && products.length > 0 && products.map((product) => (
                                    <TableRow
                                        key={product.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleRowClick(product)}
                                    >
                                        <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        {isHealthMode && <TableCell className="text-xs font-mono">{(product as any).batch_number || '-'}</TableCell>}
                                        {isHealthMode && (
                                            <TableCell className="text-xs">
                                                {(product as any).expiration_date ? (
                                                    <span className={cn(
                                                        new Date((product as any).expiration_date) < new Date() ? "text-red-500 font-bold" :
                                                            new Date((product as any).expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? "text-amber-500 font-medium" : ""
                                                    )}>
                                                        {new Date((product as any).expiration_date).toLocaleDateString('pt-BR')}
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                        )}
                                        <TableCell>{product.category || '-'}</TableCell>
                                        <TableCell>{isHealthMode ? formatCurrency((product as any).cost_price || 0) : formatCurrency(product.sale_price)}</TableCell>
                                        <TableCell className="text-center font-bold">{Number(product.quantity)}</TableCell>
                                        <TableCell className="text-xs">{product.location || '-'}</TableCell>
                                        <TableCell>{getStatusBadge(product.status, Number(product.quantity), Number(product.min_quantity))}</TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRowClick(product);
                                                }}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <CreateProductDrawer
                open={isDrawerOpen}
                onOpenChange={setIsDrawerOpen}
                onSuccess={fetchProducts}
                instanceId={instanceId}
            />

            <EditProductDrawer
                open={isEditDrawerOpen}
                onOpenChange={setIsEditDrawerOpen}
                onSuccess={fetchProducts}
                product={selectedProduct}
                instanceId={instanceId}
            />
        </div>
    );
}
