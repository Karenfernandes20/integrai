
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { toast } from "../ui/use-toast";
import { Plus, Upload, Calculator } from "lucide-react";

interface CreateProductDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CreateProductDrawer({ open, onOpenChange, onSuccess }: CreateProductDrawerProps) {
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

    const [channels, setChannels] = useState({
        pdv: true,
        whatsapp: false,
        campaigns: true,
        ai: true
    });

    const [activeTab, setActiveTab] = useState("basic");

    // Fetch Suppliers
    useEffect(() => {
        if (open && token) {
            fetch('/api/shop/suppliers', {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => setSuppliers(Array.isArray(data) ? data : []))
                .catch(console.error);
        }
    }, [open, token]);

    // Calculate Margin
    const margin = React.useMemo(() => {
        const cost = parseFloat(costPrice) || 0;
        const sale = parseFloat(salePrice) || 0;
        if (sale === 0) return 0;
        return ((sale - cost) / sale) * 100;
    }, [costPrice, salePrice]);

    const handleSubmit = async (createAnother = false) => {
        if (!name || !salePrice) {
            toast({ title: "Erro de validação", description: "Nome e Preço de Venda são obrigatórios.", variant: "destructive" });
            return;
        }

        if (parseFloat(quantity) < 0) {
            toast({ title: "Erro de validação", description: "Quantidade não pode ser negativa.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
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
                channels,
                batch_number: batchNumber,
                expiration_date: expirationDate || null
            };

            const res = await fetch('/api/shop/inventory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast({ title: "Produto cadastrado com sucesso!" });
                onSuccess();
                if (createAnother) {
                    resetForm();
                } else {
                    onOpenChange(false);
                    resetForm();
                }
            } else {
                const err = await res.json();
                toast({ title: "Erro ao cadastrar", description: err.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Erro de conexão", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName("");
        setCategory("");
        setSku("");
        setBarcode("");
        setStatus("active");
        setDescription("");
        setCostPrice("");
        setSalePrice("");
        setQuantity("");
        setMinQuantity("");
        setLocation("");
        setUnit("un");
        setSupplierId("");
        setBatchNumber("");
        setExpirationDate("");
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-2xl">{isHealthMode ? 'Cadastro de Insumo' : 'Cadastro de Produto'}</SheetTitle>
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
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder={isHealthMode ? "Ex: Luvas de Látex" : "Ex: Camiseta Básica P"} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Categoria</Label>
                                    <Input value={category} onChange={e => setCategory(e.target.value)} placeholder={isHealthMode ? "Ex: Descartáveis" : "Ex: Vestuário"} />
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
                                        <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="Ex: LT-2024-001" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Data de Validade</Label>
                                        <Input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>SKU (Opcional)</Label>
                                    <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Gerado auto..." />
                                </div>
                                <div className="space-y-2">
                                    <Label>Código de Barras</Label>
                                    <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="EAN-13" />
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
                                    <Label>{isHealthMode ? 'Preço de Saída / Uso (Opcional)' : 'Preço de Venda (R$) *'}</Label>
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
                                    <Label>Estoque Inicial</Label>
                                    <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Estoque Mínimo</Label>
                                    <Input type="number" value={minQuantity} onChange={e => setMinQuantity(e.target.value)} />
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
                                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Prateleira B3" />
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

                            <div className="space-y-4">
                                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isHealthMode ? 'Canais de Uso' : 'Canais de Venda'}</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="pdv" checked={channels.pdv} onCheckedChange={(c: any) => setChannels({ ...channels, pdv: c })} />
                                        <Label htmlFor="pdv">{isHealthMode ? 'Uso Interno' : 'PDV Loja'}</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="campaigns" checked={channels.campaigns} onCheckedChange={(c: any) => setChannels({ ...channels, campaigns: c })} />
                                        <Label htmlFor="campaigns">Campanhas</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="ai" checked={channels.ai} onCheckedChange={(c: any) => setChannels({ ...channels, ai: c })} />
                                        <Label htmlFor="ai">IA Vendedora</Label>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <SheetFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={loading}>
                            Salvar e Novo
                        </Button>
                        <Button onClick={() => handleSubmit(false)} disabled={loading}>
                            {loading ? 'Salvando...' : isHealthMode ? 'Salvar Insumo' : 'Salvar Produto'}
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
