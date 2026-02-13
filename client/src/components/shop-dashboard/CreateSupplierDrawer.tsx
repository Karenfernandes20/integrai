
import React, { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { useAuth } from '../../contexts/AuthContext';

interface CreateSupplierDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    instanceId: number | null;
}

export function CreateSupplierDrawer({ open, onOpenChange, onSuccess, instanceId }: CreateSupplierDrawerProps) {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        contact_name: '',
        phone: '',
        email: '',
        cnpj: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instanceId) return toast.error("Selecione uma instância primeiro");
        if (!formData.name) return toast.error("Nome do fornecedor é obrigatório");

        setLoading(true);
        try {
            const res = await fetch('/api/shop/suppliers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success("Fornecedor cadastrado com sucesso!");
                onSuccess();
                onOpenChange(false);
                setFormData({
                    name: '',
                    contact_name: '',
                    phone: '',
                    email: '',
                    cnpj: ''
                });
            } else {
                const err = await res.json();
                toast.error(err.error || "Erro ao cadastrar fornecedor");
            }
        } catch (error) {
            toast.error("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Novo Fornecedor</SheetTitle>
                    <SheetDescription>
                        Cadastre um novo fornecedor para o seu estoque.
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome da Empresa *</Label>
                        <Input
                            id="name"
                            placeholder="Ex: Fornecedor de Tecidos LTDA"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="contact_name">Pessoa de Contato</Label>
                        <Input
                            id="contact_name"
                            placeholder="Nome do vendedor ou gerente"
                            value={formData.contact_name}
                            onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input
                                id="phone"
                                placeholder="(00) 00000-0000"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cnpj">CNPJ</Label>
                            <Input
                                id="cnpj"
                                placeholder="00.000.000/0000-00"
                                value={formData.cnpj}
                                onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="contato@fornecedor.com.br"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={loading}>
                            {loading ? "Salvando..." : "Cadastrar"}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
