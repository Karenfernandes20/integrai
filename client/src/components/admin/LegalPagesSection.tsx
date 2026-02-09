
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { FileText, Save, Terminal, ShieldCheck } from "lucide-react";
import { useToast } from "../../hooks/use-toast";

interface LegalPagesSectionProps {
    token: string | null;
}

export function LegalPagesSection({ token }: LegalPagesSectionProps) {
    const { toast } = useToast();
    const [legalTerms, setLegalTerms] = useState("");
    const [legalPrivacy, setLegalPrivacy] = useState("");
    const [savingLegal, setSavingLegal] = useState<string | null>(null);

    useEffect(() => {
        if (token) loadLegalPages();
    }, [token]);

    const loadLegalPages = async () => {
        try {
            const tRes = await fetch("/api/admin/legal/terms");
            if (tRes.ok) setLegalTerms((await tRes.json()).content || "");

            const pRes = await fetch("/api/admin/legal/privacy");
            if (pRes.ok) setLegalPrivacy((await pRes.json()).content || "");
        } catch (e) { }
    };

    const handleSaveLegal = async (type: "terms" | "privacy") => {
        if (!token) return;
        setSavingLegal(type);
        try {
            const content = type === "terms" ? legalTerms : legalPrivacy;
            const res = await fetch(`/api/admin/legal/${type}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ content })
            });
            if (res.ok) toast({ title: "Sucesso", description: `${type === 'terms' ? 'Termos' : 'Privacidade'} atualizados com sucesso.` });
        } catch (err) { }
        setSavingLegal(null);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-strong bg-white/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-5 w-5 text-indigo-500" /> Termos de Uso
                    </CardTitle>
                    <CardDescription>Página pública exibida para todos os usuários.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        className="min-h-[400px] font-mono text-xs bg-slate-50 border-slate-200"
                        placeholder="Conteúdo em HTML ou Texto..."
                        value={legalTerms}
                        onChange={(e) => setLegalTerms(e.target.value)}
                    />
                    <Button
                        className="w-full gap-2 shadow-md"
                        onClick={() => handleSaveLegal("terms")}
                        disabled={savingLegal === "terms"}
                    >
                        {savingLegal === "terms" ? "Salvando..." : <><Save className="h-4 w-4" /> Salvar Termos</>}
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-none shadow-strong bg-white/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <ShieldCheck className="h-5 w-5 text-emerald-500" /> Política de Privacidade
                    </CardTitle>
                    <CardDescription>Página pública de proteção de dados.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        className="min-h-[400px] font-mono text-xs bg-slate-50 border-slate-200"
                        placeholder="Conteúdo em HTML ou Texto..."
                        value={legalPrivacy}
                        onChange={(e) => setLegalPrivacy(e.target.value)}
                    />
                    <Button
                        className="w-full gap-2 shadow-md"
                        variant="secondary"
                        onClick={() => handleSaveLegal("privacy")}
                        disabled={savingLegal === "privacy"}
                    >
                        {savingLegal === "privacy" ? "Salvando..." : <><Save className="h-4 w-4" /> Salvar Privacidade</>}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

