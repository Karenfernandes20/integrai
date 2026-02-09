
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, FileText, Plus, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

// Mock data type
interface Patient {
    id: number;
    name: string;
    age: number;
    specialty: string;
    lastVisit: string;
    cpf?: string;
}

export default function ProntuarioPage() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // In a real app, fetch from API. Mocking for UI functionality.
    const [patients, setPatients] = useState<Patient[]>([
        { id: 1, name: "João Silva", age: 32, specialty: "Cardiologia", lastVisit: "12/10/2023", cpf: "123.456.789-00" },
        { id: 2, name: "Maria Oliveira", age: 28, specialty: "Dermatologia", lastVisit: "05/11/2023", cpf: "987.654.321-11" },
        { id: 3, name: "Pedro Santos", age: 45, specialty: "Ortopedia", lastVisit: "20/09/2023", cpf: "111.222.333-44" },
    ]);

    // New Patient Form State
    const [newPatient, setNewPatient] = useState<{ name: string, age: string, specialty: string, cpf: string }>({ name: '', age: '', specialty: '', cpf: '' });

    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.cpf && p.cpf.includes(searchTerm))
    );

    const handleCreateStats = () => {
        if (!newPatient.name) return;

        const newId = patients.length + 1;
        const patient: Patient = {
            id: newId,
            name: newPatient.name,
            age: parseInt(newPatient.age) || 0,
            specialty: newPatient.specialty || "Clínica Geral",
            lastVisit: new Date().toLocaleDateString('pt-BR'),
            cpf: newPatient.cpf
        };

        setPatients([patient, ...patients]);
        setNewPatient({ name: '', age: '', specialty: '', cpf: '' });
        setIsCreateOpen(false);

        toast({
            title: "Prontuário Criado",
            description: `O prontuário de ${patient.name} foi iniciado com sucesso.`
        });
    };

    const handleOpenProntuario = (id: number) => {
        toast({
            title: "Abrindo Prontuário",
            description: `Funcionalidade de detalhes do paciente #${id} em desenvolvimento.`
        });
    };

    return (
        <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Prontuário Eletrônico</h1>
                    <p className="text-slate-500">Gerencie o histórico clínico dos seus pacientes.</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Prontuário
                </Button>
            </div>

            <div className="flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar paciente por nome, CPF ou telefone..."
                        className="pl-10 bg-white border-slate-200 focus:border-blue-500 transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {filteredPatients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPatients.map((p) => (
                        <Card
                            key={p.id}
                            className="hover:shadow-lg transition-all duration-200 cursor-pointer border-slate-200 group bg-white"
                            onClick={() => handleOpenProntuario(p.id)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold group-hover:bg-blue-100 transition-colors">
                                        {p.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                                        <FileText className="h-4 w-4" />
                                    </Button>
                                </div>
                                <CardTitle className="mt-4 text-lg truncate" title={p.name}>{p.name}</CardTitle>
                                <CardDescription>Última consulta: {p.lastVisit}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-slate-600 space-y-2">
                                    <p className="flex items-center gap-2">
                                        <User className="h-3.5 w-3.5 text-slate-400" /> {p.age} anos
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium border border-slate-200">
                                            {p.specialty}
                                        </span>
                                        {p.cpf && <span className="text-[10px] text-slate-400">{p.cpf}</span>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                    <div className="mx-auto h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <User className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">Nenhum paciente encontrado</h3>
                    <p className="text-sm mt-1">Tente buscar com outros termos ou crie um novo prontuário.</p>
                </div>
            )}

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Prontuário</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Nome Completo</Label>
                            <Input
                                value={newPatient.name}
                                onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                                placeholder="Ex: João da Silva"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Idade</Label>
                                <Input
                                    type="number"
                                    value={newPatient.age}
                                    onChange={e => setNewPatient({ ...newPatient, age: e.target.value })}
                                    placeholder="Ex: 32"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>CPF</Label>
                                <Input
                                    value={newPatient.cpf}
                                    onChange={e => setNewPatient({ ...newPatient, cpf: e.target.value })}
                                    placeholder="000.000.000-00"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Especialidade Principal</Label>
                            <Input
                                value={newPatient.specialty}
                                onChange={e => setNewPatient({ ...newPatient, specialty: e.target.value })}
                                placeholder="Ex: Cardiologia"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateStats} disabled={!newPatient.name}>Criar Prontuário</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
