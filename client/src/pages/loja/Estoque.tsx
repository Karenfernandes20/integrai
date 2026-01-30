
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Plus, Search, Filter, AlertTriangle, Package } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CreateProductDrawer } from '../../components/shop-dashboard/CreateProductDrawer';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Badge } from '../../components/ui/badge';

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
    const { token } = useAuth();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const query = searchTerm ? `?search=${searchTerm}` : '';
            const res = await fetch(`/api/shop/inventory${query}`, {
                headers: { Authorization: `Bearer ${token}` }
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
        if (token) fetchProducts();
    }, [token, searchTerm]);

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

    const formatCurrency = (val: string | number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
    };

    const getStatusBadge = (status: string, qty: number, minQty: number) => {
        if (qty <= minQty) return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Baixo Estoque</Badge>;
        if (status === 'active') return <Badge className="bg-green-600">Ativo</Badge>;
        return <Badge variant="secondary">Inativo</Badge>;
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Estoque</h1>
                <Button onClick={() => setIsDrawerOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Produto
                </Button>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, SKU ou categoria..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline"><Filter className="h-4 w-4 mr-2" /> Filtros</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Produtos Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">SKU</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Preço Venda</TableHead>
                                    <TableHead className="text-center">Estoque</TableHead>
                                    <TableHead>Local</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell>
                                    </TableRow>
                                ) : products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center h-40">
                                            <Package className="h-10 w-10 mb-2 opacity-50" />
                                            Nenhum produto encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell>{product.category || '-'}</TableCell>
                                            <TableCell>{formatCurrency(product.sale_price)}</TableCell>
                                            <TableCell className="text-center font-bold">{Number(product.quantity)}</TableCell>
                                            <TableCell className="text-xs">{product.location || '-'}</TableCell>
                                            <TableCell>{getStatusBadge(product.status, Number(product.quantity), Number(product.min_quantity))}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <CreateProductDrawer
                open={isDrawerOpen}
                onOpenChange={setIsDrawerOpen}
                onSuccess={fetchProducts}
            />
        </div>
    );
}
