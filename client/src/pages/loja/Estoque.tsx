
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus } from 'lucide-react';

export default function EstoquePage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Estoque</h1>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Novo Produto
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Produtos</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Listagem de estoque será exibida aqui.</p>
                </CardContent>
            </Card>
        </div>
    );
}
