
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Trash, Search, ShoppingCart, Loader2 } from 'lucide-react';
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
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [instanceId, setInstanceId] = useState<number | null>(null);
    const [fetchingInstance, setFetchingInstance] = useState(false);

    // Form State
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<string>("pix");

    // Product Selection State
    const [selectedProduct, setSelectedProduct] = useState<string>("");
    const [qty, setQty] = useState<number>(1);

    // Fetch Instance First
    const fetchInstance = async () => {
        if (!token || !user?.company_id) return;
        try {
            setFetchingInstance(true);
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
        } finally {
            setFetchingInstance(false);
        }
    };

    // Fetch Data
    useEffect(() => {
        if (open && token) {
            fetchInstance();
            fetchClients();
            // Reset state
            setCart([]);
            setDiscount(0);
            setSelectedClientId("");
            setPaymentMethod("pix");
            setSelectedProduct("");
            setQty(1);
        }
    }, [open, token]);

    // Re-fetch products when instanceId is resolved
    useEffect(() => {
        if (open && token && instanceId) {
            fetchProducts();
        }
    }, [open, token, instanceId]);

    const fetchClients = async () => {
        try {
            const res = await fetch('/api/crm/leads', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setClients(data);
            }
        } catch (e) { console.error("Error fetching clients", e); }
    };

    const fetchProducts = async () => {
        if (!instanceId) return;
        try {
            const res = await fetch(`/api/shop/inventory?instance_id=${instanceId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                }
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

        // Check if already in cart
        const existing = cart.find(item => item.inventory_id === product.id);
        if (existing) {
            toast({ title: "Produto já no carrinho", description: "Aumente a quantidade se desejar.", variant: "default" });
            return;
        }

        // Check stock availability
        if (qty > product.quantity) {
            toast({
                title: "Estoque insuficiente",
                description: `Você solicitou ${qty}, mas só existem ${product.quantity} unidades disponíveis.`,
                variant: "destructive"
            });
            return;
        }

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
        if (!instanceId) {
            toast({ title: "Erro", description: "Instância não identificada.", variant: "destructive" });
            return;
        }
        if (cart.length === 0) {
            toast({ title: "Carrinho vazio", description: "Adicione produtos antes de finalizar.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                instance_id: instanceId,
                client_id: selectedClientId && selectedClientId !== "0" ? Number(selectedClientId) : null,
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
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast({ title: "Venda realizada com sucesso!" });
                onSuccess();
                onOpenChange(false);
                // navigate('/app/loja/estoque'); // Removed per user request
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
            <DialogContent className="w-full max-w-3xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl max-h-[90vh] flex flex-col">
                <DialogHeader className="bg-primary px-6 py-4 text-primary-foreground shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            Nova Venda
                        </DialogTitle>
                        {/* Standard close is often provided by DialogContent or we can keep a custom one if needed, but 'X' usually exists. 
                            If the user said it was hard to click 'X', we might want to ensure the standard one is visible or this custom one is better positioned. 
                            I will keep a clear custom close button but ensure it's well positioned. 
                        */}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {fetchingInstance ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Configurando ambiente de venda...</p>
                        </div>
                    ) : (
                        <>
                            {/* Top Section: Client & Meta */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Cliente</Label>
                                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Selecione um cliente (opcional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">Cliente Balcão (Sem cadastro)</SelectItem>
                                            {clients.map(c => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Método de Pagamento</Label>
                                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                        <SelectTrigger className="h-10">
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
                            <div className="bg-muted/30 p-4 rounded-xl border border-dashed border-muted-foreground/20">
                                <Label className="text-xs font-bold uppercase text-muted-foreground mb-3 block">Adicionar Itens</Label>
                                <div className="flex flex-col sm:flex-row gap-3 items-end">
                                    <div className="flex-1 space-y-2 w-full">
                                        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="Escolha um produto..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products.length === 0 ? (
                                                    <div className="p-4 text-center text-xs text-muted-foreground italic">
                                                        Nenhum produto com estoque.
                                                    </div>
                                                ) : (
                                                    products.map(p => (
                                                        <SelectItem key={p.id} value={p.id.toString()} disabled={Number(p.quantity) <= 0}>
                                                            {p.name} - R$ {Number(p.sale_price).toFixed(2)}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-24 space-y-2">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={qty}
                                            onChange={e => setQty(Number(e.target.value))}
                                            className="h-10 text-center font-bold"
                                        />
                                    </div>
                                    <Button onClick={handleAddItem} disabled={!selectedProduct} className="h-10 w-full sm:w-auto px-6">
                                        <Plus className="h-4 w-4 mr-2" /> Incluir
                                    </Button>
                                </div>
                            </div>

                            {/* Cart Table */}
                            <div className="border rounded-xl overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead className="w-16 text-center">Qtd</TableHead>
                                            <TableHead className="w-24 text-right">Unit.</TableHead>
                                            <TableHead className="w-24 text-right">Total</TableHead>
                                            <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cart.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    <div className="flex flex-col items-center gap-2 opacity-50">
                                                        <ShoppingCart className="h-6 w-6" />
                                                        <p className="text-xs">Carrinho vazio</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {cart.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium text-sm truncate max-w-[12rem]">{item.name}</TableCell>
                                                <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                                                <TableCell className="text-right text-xs">R$ {item.unit_price.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-bold text-primary text-sm">R$ {item.total.toFixed(2)}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700 h-7 w-7 p-0 rounded-full">
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Totals Section */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 p-4 rounded-xl border border-muted-foreground/10">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Subtotal: R$ {subtotal.toFixed(2)}</p>
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs font-medium">Desconto:</Label>
                                        <Input
                                            type="number"
                                            className="w-20 h-8 text-right font-medium text-sm"
                                            value={discount}
                                            onChange={e => setDiscount(Number(e.target.value))}
                                        />
                                    </div>
                                </div>
                                <div className="text-right w-full sm:w-auto flex flex-col items-end">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Valor Final</p>
                                    <p className="text-3xl font-black text-primary leading-tight">
                                        R$ {calculateTotal().toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter className="p-4 bg-muted/30 border-t flex-col sm:flex-row gap-3 shrink-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-10 px-6 font-bold w-full sm:w-auto">Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || cart.length === 0 || fetchingInstance}
                        className="h-10 px-8 font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-100 w-full sm:w-auto"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {loading ? "Processando..." : "Finalizar Venda"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
