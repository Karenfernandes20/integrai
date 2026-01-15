
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LegalPageProps {
    type: 'terms' | 'privacy';
}

const LegalPage: React.FC<LegalPageProps> = ({ type }) => {
    const [content, setContent] = useState<string>('');
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const res = await fetch(`/api/legal-pages/${type}`);
                if (res.ok) {
                    const data = await res.json();
                    setContent(data.content);
                    setUpdatedAt(data.last_updated_at);
                } else {
                    console.error('Failed to fetch legal page');
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [type]);

    const title = type === 'terms' ? 'Termos de Serviço' : 'Política de Privacidade';
    const metaDescription = type === 'terms'
        ? 'Termos de Serviço da Integrai - Regras e condições de uso.'
        : 'Política de Privacidade da Integrai - Como tratamos seus dados.';

    // SEO Injection (Simple method, ideally use Helmet or similar if avail)
    useEffect(() => {
        document.title = `${title} | Integrai`;
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', metaDescription);
    }, [title, metaDescription]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-4xl shadow-lg">
                    <CardHeader>
                        <Skeleton className="h-8 w-1/3 mx-auto" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header Simples */}
            <header className="bg-white border-b py-4 shadow-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <img src="/logo_integrai_w.png" alt="Integrai Logo" className="h-8 w-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
                        <span className="font-bold text-xl text-primary">Integrai</span>
                    </div>
                    <nav className="hidden md:flex gap-4 text-sm font-medium text-slate-600">
                        <a href="/login" className="hover:text-primary">Login</a>
                        <a href="/register" className="hover:text-primary">Cadastro</a>
                    </nav>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
                <Card className="max-w-4xl mx-auto shadow-sm border-slate-200">
                    <CardHeader className="text-center border-b bg-slate-50/50 pb-8 pt-8">
                        <CardTitle className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">
                            {title}
                        </CardTitle>
                        {updatedAt && (
                            <p className="text-slate-500 mt-2 text-sm">
                                Última atualização em {format(new Date(updatedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                        )}
                    </CardHeader>
                    <CardContent className="p-6 md:p-10 prose prose-slate max-w-none prose-headings:text-slate-800 prose-a:text-primary">
                        <div dangerouslySetInnerHTML={{ __html: content || '<p class="text-center text-slate-500 italic">Conteúdo em atualização.</p>' }} />
                    </CardContent>
                </Card>
            </main>

            <footer className="bg-slate-900 text-slate-400 py-8 mt-auto">
                <div className="container mx-auto px-4 text-center text-sm">
                    <div className="flex justify-center gap-6 mb-4">
                        <a href="/termos-de-servico" className="hover:text-white transition-colors">Termos de Serviço</a>
                        <a href="/politica-de-privacidade" className="hover:text-white transition-colors">Política de Privacidade</a>
                    </div>
                    <p>&copy; {new Date().getFullYear()} Integrai. Todos os direitos reservados.</p>
                </div>
            </footer>
        </div>
    );
};

export default LegalPage;
