import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { toast } from "../ui/use-toast";
import { Calculator } from "lucide-react";

interface EditProductDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    product: any | null;
    instanceId: number | null;
}

export function EditProductDrawer({ open, onOpenChange, onSuccess, product, instanceId }: EditProductDrawerProps) {
    const { token, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const isHealthMode = user?.company?.operation_type === 'pacientes' || user?.company?.operational_profile === 'CLINICA' || user?.company?.category === 'clinica';

    // Form States
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [sku, setSku] = useState("");
    const [barcode, setBarcode] = useState("");
    const [status, setStatus] = useState("active");
    const [description, setDescription] = useState("");
    const [batchNumber, setBatchNumber] = useState("");
    const [expirationDate, setExpirationDate] = useState("");
    const [costPrice, setCostPrice] = useState("");
    const [salePrice, setSalePrice] = useState("");
    const [quantity, setQuantity] = useState("");
    const [minQuantity, setMinQuantity] = useState("");
    const [location, setLocation] = useState("");
    const [unit, setUnit] = useState("un");
    const [supplierId, setSupplierId] = useState("");
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("basic");

    // Load product data when modal opens
    useEffect(() => {
        if (product && open) {
            setName(product.name || "");
            setCategory(product.category || "");
            setSku(product.sku || "");
            setBarcode(product.barcode || "");
            setStatus(product.status || "active");
            setDescription(product.description || "");
            setBatchNumber(product.batch_number || "");
            setExpirationDate(product.expiration_date || "");
            setCostPrice(product.cost_price?.toString() || "");
            setSalePrice(product.sale_price?.toString() || "");
            setQuantity(product.quantity?.toString() || "");
            setMinQuantity(product.min_quantity?.toString() || "");
            setLocation(product.location || "");
            setUnit(product.unit || "un");
            setSupplierId(product.supplier_id?.toString() || "");
        }
    }, [product, open]);

    // Fetch Suppliers
    useEffect(() => {
        if (open && token && instanceId) {
            fetch(`/api/shop/suppliers?instance_id=${instanceId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                }
            })
                .then(res => res.json())
                .then(data => setSuppliers(Array.isArray(data) ? data : []))
                .catch(console.error);
        }
    }, [open, token, instanceId]);

    // Calculate Margin
    const margin = React.useMemo(() => {
        const cost = parseFloat(costPrice) || 0;
        const sale = parseFloat(salePrice) || 0;
        if (sale === 0) return 0;
        return ((sale - cost) / sale) * 100;
    }, [costPrice, salePrice]);

    const handleSubmit = async () => {
        if (!name || !salePrice) {
            toast({
                title: "Erro de validação",
                description: "Nome e Preço de Venda são obrigatórios.",
                variant: "destructive"
            });
            return;
        }

        if (!product?.id) {
            toast({
                title: "Erro",
                description: "ID do produto não encontrado.",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            if (!instanceId) {
                toast({
                    title: "Instância não encontrada",
                    description: "Selecione/conecte uma instância para salvar produtos.",
                    variant: "destructive"
                });
                setLoading(false);
                return;
            }
            const payload = {
                name,
                category,
                sku,
                barcode,
                status,
                description,
                cost_price: parseFloat(costPrice) || 0,
                sale_price: parseFloat(salePrice) || 0,
                quantity: parseFloat(quantity) || 0,
                min_quantity: parseFloat(minQuantity) || 0,
                location,
                unit,
                supplier_id: supplierId ? parseInt(supplierId) : null,
                batch_number: batchNumber,
                expiration_date: expirationDate || null,
                instance_id: instanceId
            };

            const res = await fetch(`/api/shop/inventory/${product.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast({ title: "Produto atualizado com sucesso!" });
                onSuccess();
                onOpenChange(false);
            } else {
                const err = await res.json();
                toast({
                    title: "Erro ao atualizar",
                    description: err.error || "Erro desconhecido",
                    variant: "destructive"
                });
            }
        } catch (e) {
            console.error('Update error:', e);
            toast({ title: "Erro de conexão", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-2xl">
                        {isHealthMode ? 'Editar Insumo' : 'Editar Produto'}
                    </SheetTitle>
                </SheetHeader>

                <div className="py-6 space-y-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="w-full grid grid-cols-4">
                            <TabsTrigger value="basic">Dados</TabsTrigger>
                            <TabsTrigger value="prices">Preço</TabsTrigger>
                            <TabsTrigger value="stock">Estoque</TabsTrigger>
                            <TabsTrigger value="extra">Mais</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>{isHealthMode ? 'Nome do Insumo *' : 'Nome do Produto *'}</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Categoria</Label>
                                    <Input value={category} onChange={e => setCategory(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select value={status} onValueChange={setStatus}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Ativo</SelectItem>
                                            <SelectItem value="inactive">Inativo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {isHealthMode && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Número do Lote</Label>
                                        <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Data de Validade</Label>
                                        <Input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>SKU</Label>
                                    <Input value={sku} onChange={e => setSku(e.target.value)} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Código de Barras</Label>
                                    <Input value={barcode} onChange={e => setBarcode(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                            </div>
                        </TabsContent>

                        <TabsContent value="prices" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{isHealthMode ? 'Preço de Compra (R$)' : 'Preço de Custo (R$)'}</Label>
                                    <Input
                                        type="number"
                                        value={costPrice}
                                        onChange={e => setCostPrice(e.target.value)}
                                        step="0.01"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{isHealthMode ? 'Preço de Saída (R$) *' : 'Preço de Venda (R$) *'}</Label>
                                    <Input
                                        type="number"
                                        value={salePrice}
                                        onChange={e => setSalePrice(e.target.value)}
                                        step="0.01"
                                        className="font-bold"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calculator className="h-4 w-4" />
                                    <span>Margem Estimada</span>
                                </div>
                                <span className={`text-lg font-bold ${margin < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    {margin.toFixed(2)}%
                                </span>
                            </div>
                        </TabsContent>

                        <TabsContent value="stock" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Estoque Atual</Label>
                                    <Input
                                        type="number"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Estoque Mínimo</Label>
                                    <Input
                                        type="number"
                                        value={minQuantity}
                                        onChange={e => setMinQuantity(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Unidade</Label>
                                    <Select value={unit} onValueChange={setUnit}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="un">Unidade</SelectItem>
                                            <SelectItem value="kg">Kg</SelectItem>
                                            <SelectItem value="L">Litro</SelectItem>
                                            <SelectItem value="cx">Caixa</SelectItem>
                                            <SelectItem value="m">Metro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Localização</Label>
                                    <Input value={location} onChange={e => setLocation(e.target.value)} />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="extra" className="space-y-6 mt-4">
                            <div className="space-y-2">
                                <Label>Fornecedor</Label>
                                <Select value={supplierId} onValueChange={setSupplierId}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <SheetFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
