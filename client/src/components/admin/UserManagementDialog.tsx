
import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "../ui/table";
import {
    Plus,
    Trash2,
    Key,
    Mail,
    UserCircle,
    ShieldCheck,
    Settings2,
    Users
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Separator } from "../ui/separator";
import { useToast } from "../../hooks/use-toast";
import { Company, AppUser } from "./types";
import { PERMISSION_GROUPS, ROLE_PRESETS } from "../../lib/permissions";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface UserManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    company: Company | null;
    token: string | null;
}

export function UserManagementDialog({ open, onOpenChange, company, token }: UserManagementDialogProps) {
    const { toast } = useToast();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [newUser, setNewUser] = useState({
        full_name: "",
        email: "",
        password: "",
        role: "USUARIO",
        permissions: ROLE_PRESETS["USUARIO"] || []
    });

    useEffect(() => {
        if (open && company && token) {
            loadUsers();
        }
    }, [open, company, token]);

    const loadUsers = async () => {
        if (!company) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/companies/${company.id}/users`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) setUsers(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = (role: string) => {
        setNewUser(p => ({
            ...p,
            role,
            permissions: role === "CUSTOM" ? p.permissions : (ROLE_PRESETS[role] || [])
        }));
    };

    const togglePermission = (id: string) => {
        setNewUser(prev => {
            const newPerms = prev.permissions.includes(id)
                ? prev.permissions.filter(p => p !== id)
                : [...prev.permissions, id];
            return { ...prev, permissions: newPerms, role: "CUSTOM" };
        });
    };

    const handleCreateUser = async () => {
        if (!company || !token) return;
        if (!newUser.full_name || !newUser.email || !newUser.password) {
            toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const res = await fetch(`/api/users`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...newUser,
                    company_id: company.id
                })
            });

            if (!res.ok) throw new Error(await res.text());

            toast({ title: "Sucesso", description: "Usuário criado com sucesso!" });
            setNewUser({
                full_name: "",
                email: "",
                password: "",
                role: "USUARIO",
                permissions: ROLE_PRESETS["USUARIO"]
            });
            loadUsers();
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!token || !window.confirm("Deseja realmente excluir este usuário?")) return;
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                toast({ title: "Sucesso", description: "Usuário removido." });
                loadUsers();
            }
        } catch (err) { }
    };

    const submitPasswordReset = async (userId: number) => {
        const newPass = prompt("Digite a nova senha:");
        if (!newPass || !token) return;

        try {
            const res = await fetch(`/api/users/${userId}/reset-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ password: newPass })
            });
            if (res.ok) toast({ title: "Sucesso", description: "Senha alterada com sucesso." });
            else throw new Error("Erro ao alterar senha.");
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Users className="h-6 w-6 text-primary" />
                        Gestão de Usuários - {company?.name}
                    </DialogTitle>
                    <DialogDescription>
                        Configure os acessos e permissões para os membros da empresa.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-8 mt-6">
                    {/* New User Section */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-6 uppercase tracking-wider">
                            <Plus className="h-4 w-4 text-primary" /> Novo Membro
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Nome Completo</Label>
                                <Input
                                    placeholder="Ex: João Silva"
                                    value={newUser.full_name}
                                    onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))}
                                    className="bg-white border-slate-200 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">E-mail de Acesso</Label>
                                <Input
                                    placeholder="joao@empresa.com"
                                    value={newUser.email}
                                    onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                                    className="bg-white border-slate-200 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Senha Temporária</Label>
                                <Input
                                    type="password"
                                    placeholder="********"
                                    value={newUser.password}
                                    onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                                    className="bg-white border-slate-200 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Nível de Acesso (Preset)</Label>
                                <Select value={newUser.role} onValueChange={handleRoleChange}>
                                    <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ADMIN">Administrador Full</SelectItem>
                                        <SelectItem value="MANAGER">Gestor / Supervisor</SelectItem>
                                        <SelectItem value="VENDEDOR">Vendedor / Comercial</SelectItem>
                                        <SelectItem value="ATENDENTE">Atendimento</SelectItem>
                                        <SelectItem value="FINANCEIRO">Financeiro / Contas</SelectItem>
                                        <SelectItem value="USUARIO">Usuário Comum</SelectItem>
                                        <SelectItem value="CUSTOM">Personalizado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="mt-8 space-y-4 pt-6 border-t border-slate-200">
                            <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" /> Permissões Granulares
                                </h5>
                                <Badge variant="secondary" className="text-[10px] font-bold">
                                    {newUser.permissions.length} PERMISSÕES ATIVAS
                                </Badge>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                                {PERMISSION_GROUPS.map(group => (
                                    <div key={group.name} className="space-y-3">
                                        <Label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 border-b pb-1.5">
                                            {group.name}
                                        </Label>
                                        <div className="space-y-2">
                                            {group.permissions.map(perm => (
                                                <div key={perm.id} className="flex items-center space-x-2 group">
                                                    <Checkbox
                                                        id={`perm-${perm.id}`}
                                                        checked={newUser.permissions.includes(perm.id)}
                                                        onCheckedChange={() => togglePermission(perm.id)}
                                                        className="h-3.5 w-3.5"
                                                    />
                                                    <label
                                                        htmlFor={`perm-${perm.id}`}
                                                        className="text-[11px] font-medium text-slate-600 leading-tight cursor-pointer group-hover:text-primary transition-colors"
                                                    >
                                                        {perm.label}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <Button onClick={handleCreateUser} disabled={isCreating} className="px-10 h-11 shadow-lg gap-2">
                                {isCreating ? "Criando..." : <><Plus className="h-4 w-4" /> Finalizar Cadastro de Usuário</>}
                            </Button>
                        </div>
                    </div>

                    <Separator className="my-10" />

                    {/* User List Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                            <UserCircle className="h-5 w-5 text-slate-400" /> Membros Cadastrados
                        </h4>
                        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                            <Table>
                                <TableHeader className="bg-slate-50/80">
                                    <TableRow>
                                        <TableHead>Membro</TableHead>
                                        <TableHead>E-mail</TableHead>
                                        <TableHead className="text-center">Nível</TableHead>
                                        <TableHead className="text-right px-6">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-400">Carregando lista de membros...</TableCell></TableRow>
                                    ) : users.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-400 font-medium italic">Nenhum membro vinculado a esta empresa.</TableCell></TableRow>
                                    ) : users.map(u => (
                                        <TableRow key={u.id} className="hover:bg-slate-50 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs border border-slate-200">
                                                        {u.full_name?.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-slate-700">{u.full_name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-500 text-xs font-medium">
                                                <Mail className="h-3 w-3 inline mr-1.5 opacity-60" /> {u.email}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="bg-white border-slate-200 text-[#64748B] text-[10px] font-bold uppercase tracking-tight h-6">
                                                    {u.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right px-6">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-all"
                                                        onClick={() => submitPasswordReset(u.id)}
                                                        title="Resetar Senha"
                                                    >
                                                        <Key className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 transition-all"
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        title="Remover"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
