
import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "../ui/table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import {
    Pencil,
    Trash2,
    Users,
    ShieldAlert,
    Plus,
    Search,
    Building2,
    MapPin,
    Terminal
} from "lucide-react";
import { Input } from "../ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Company } from "./types";
import { cn } from "../../lib/utils";

interface CompanyListProps {
    companies: Company[];
    isLoading: boolean;
    onEdit: (company: Company) => void;
    onDelete: (company: Company) => void;
    onManageUsers: (company: Company) => void;
    onManageInstances: (company: Company) => void;
    onOpenDashboard: (company: Company) => void;
    onAddNew: () => void;
}

export function CompanyList({
    companies,
    isLoading,
    onEdit,
    onDelete,
    onManageUsers,
    onManageInstances,
    onOpenDashboard,
    onAddNew
}: CompanyListProps) {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toString().includes(searchTerm) ||
        c.city?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card className="border-none shadow-strong bg-white/80 backdrop-blur-sm">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6">
                <div>
                    <CardTitle className="text-2xl font-bold text-slate-800">Empresas Cadastradas</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">Gerencie as organizações e acessos do sistema.</p>
                </div>
                <Button onClick={onAddNew} className="gap-2 shadow-lg hover:shadow-xl transition-all h-11 px-6 bg-primary hover:bg-primary/90">
                    <Plus className="h-5 w-5" />
                    Nova Empresa
                </Button>
            </CardHeader>

            <CardContent className="space-y-6">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por nome, ID ou cidade..."
                        className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="w-[80px]">ID</TableHead>
                                <TableHead>Empresa</TableHead>
                                <TableHead>Localização</TableHead>
                                <TableHead>Plano / Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                                        Carregando empresas...
                                    </TableCell>
                                </TableRow>
                            ) : filteredCompanies.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                                        Nenhuma empresa encontrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCompanies.map((company) => (
                                    <TableRow key={company.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="font-mono text-xs text-slate-500">#{company.id}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                                                    {company.logo_url ? (
                                                        <img src={company.logo_url} alt={company.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <Building2 className="h-5 w-5 text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-700">{company.name}</span>
                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{company.cnpj || 'Sem CNPJ'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {company.city ? (
                                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                                    {company.city}, {company.state}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">Não informado</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="outline" className="w-fit bg-slate-50 text-slate-600 border-slate-200">
                                                    Plano {company.plan_id || 'N/A'}
                                                </Badge>
                                                {company.max_instances && company.max_instances > 1 && (
                                                    <Badge variant="outline" className="w-fit bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] h-5">
                                                        {company.max_instances} Conexões
                                                    </Badge>
                                                )}
                                                {company.due_date && (
                                                    <span className={cn(
                                                        "text-[10px] font-medium",
                                                        new Date(company.due_date) < new Date() ? "text-red-500" : "text-green-600"
                                                    )}>
                                                        Expira em: {new Date(company.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-all">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => onOpenDashboard(company)}
                                                    title="Acessar Dashboard"
                                                >
                                                    <ShieldAlert className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                    onClick={() => onManageInstances(company)}
                                                    title="Instâncias WhatsApp"
                                                >
                                                    <Terminal className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                                    onClick={() => onManageUsers(company)}
                                                    title="Usuários"
                                                >
                                                    <Users className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                    onClick={() => onEdit(company)}
                                                    title="Editar"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Excluir {company.name}?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta ação é irreversível e removerá permanentemente todos os dados, usuários, mensagens e configurações vinculadas a esta empresa.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => onDelete(company)}>
                                                                Confirmar Exclusão
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
