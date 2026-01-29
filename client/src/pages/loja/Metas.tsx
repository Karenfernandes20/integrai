
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus } from 'lucide-react';

export default function MetasPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Metas & Equipe</h1>
                <Button>
                    Nova Meta
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Metas de Vendas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Progresso das metas.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Ranking da Equipe</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Performance dos vendedores.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
