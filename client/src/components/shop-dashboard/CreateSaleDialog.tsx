
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Trash, Search, ShoppingCart } from 'lucide-react';
import { toast } from '../ui/use-toast';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "../ui/table";

interface Product {
    id: number;
    name: string;
    sale_price: string | number;
    quantity: number; // Stock available
}

interface Client {
    id: number;
    name: string;
}

interface CartItem {
    inventory_id: number;
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface CreateSaleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CreateSaleDialog({ open, onOpenChange, onSuccess }: CreateSaleDialogProps) {
    const { token } = useAuth();
    const [step, setStep] = useState(1);
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<string>("pix");

    // Product Selection State
    const [selectedProduct, setSelectedProduct] = useState<string>("");
    const [qty, setQty] = useState<number>(1);

    // Fetch Data
    useEffect(() => {
        if (open && token) {
            fetchClients();
            fetchProducts();
            // Reset state
            setCart([]);
            setStep(1);
            setDiscount(0);
            setSelectedClientId("");
            setPaymentMethod("pix");
        }
    }, [open, token]);

    const fetchClients = async () => {
        try {
            const res = await fetch('/api/crm/leads', { // Using leads as clients
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setClients(data);
            }
        } catch (e) { console.error("Error fetching clients", e); }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/shop/inventory', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (e) { console.error("Error fetching products", e); }
    };

    const handleAddItem = () => {
        if (!selectedProduct) return;
        const product = products.find(p => p.id.toString() === selectedProduct);
        if (!product) return;

        const newItem: CartItem = {
            inventory_id: product.id,
            name: product.name,
            quantity: qty,
            unit_price: Number(product.sale_price),
            total: Number(product.sale_price) * qty
        };

        setCart([...cart, newItem]);
        setSelectedProduct("");
        setQty(1);
    };

    const handleRemoveItem = (index: number) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const calculateTotal = () => {
        const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
        return subtotal - discount;
    };

    const handleSubmit = async () => {
        if (cart.length === 0) {
            toast({ title: "Carrinho vazio", description: "Adicione produtos antes de finalizar.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                client_id: selectedClientId ? Number(selectedClientId) : null,
                items: cart.map(item => ({
                    inventory_id: item.inventory_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price
                })),
                payment_method: paymentMethod,
                discount: discount,
                status: 'completed'
            };

            const res = await fetch('/api/shop/sales', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast({ title: "Venda realizada com sucesso!" });
                onSuccess();
                onOpenChange(false);
            } else {
                const err = await res.json();
                toast({ title: "Erro ao realizar venda", description: err.error || "Erro desconhecido", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Erro de conexão", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const subtotal = cart.reduce((acc, item) => acc + item.total, 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Nova Venda</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Top Section: Client & Meta */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cliente</Label>
                            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um cliente (opcional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Cliente Balcão (Sem cadastro)</SelectItem> {/* Handling generic */}
                                    {clients.map(c => (
                                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Método de Pagamento</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pix">PIX</SelectItem>
                                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                                    <SelectItem value="cash">Dinheiro</SelectItem>
                                    <SelectItem value="boleto">Boleto</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Middle Section: Add Product */}
                    <div className="flex gap-4 items-end bg-muted/30 p-4 rounded-lg border">
                        <div className="flex-1 space-y-2">
                            <Label>Produto</Label>
                            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Buscar produto..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>
                                            {p.name} (R$ {Number(p.sale_price).toFixed(2)}) - Est: {p.quantity}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-24 space-y-2">
                            <Label>Qtd</Label>
                            <Input type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} />
                        </div>
                        <Button onClick={handleAddItem} disabled={!selectedProduct}>
                            <Plus className="h-4 w-4" /> Adicionar
                        </Button>
                    </div>

                    {/* Cart Table */}
                    <div className="border rounded-md max-h-[300px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="w-20">Qtd</TableHead>
                                    <TableHead className="w-24">Unitário</TableHead>
                                    <TableHead className="w-24 text-right">Total</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cart.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            Nenhum produto adicionado.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {cart.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>R$ {item.unit_price.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-medium">R$ {item.total.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700 h-8 w-8 p-0">
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Totals Section */}
                    <div className="flex justify-end items-end flex-col gap-2 bg-muted/50 p-4 rounded-lg">
                        <div className="flex items-center gap-4 text-sm">
                            <span>Subtotal:</span>
                            <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Label className="text-sm font-normal">Desconto (R$):</Label>
                            <Input
                                type="number"
                                className="w-24 h-8 text-right"
                                value={discount}
                                onChange={e => setDiscount(Number(e.target.value))}
                            />
                        </div>
                        <div className="flex items-center gap-4 text-lg font-bold mt-2">
                            <span>Total Final:</span>
                            <span className="text-primary">R$ {calculateTotal().toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading || cart.length === 0}>
                        {loading ? "Processando..." : "Finalizar Venda"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
