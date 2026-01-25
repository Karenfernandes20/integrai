
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Plus,
    Search,
    UtensilsCrossed,
    Image as ImageIcon,
    Clock,
    DollarSign,
    Edit3,
    Trash2,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { cn } from "../../lib/utils";

const CardapioPage = () => {
    const [selectedCategory, setSelectedCategory] = useState('Todos');

    const categories = ['Todos', 'Entradas', 'Pratos Principais', 'Bebidas', 'Sobremesas', 'Combos'];

    const menuItems = [
        { id: 1, name: 'Burger House Clássico', category: 'Pratos Principais', price: 38.00, time: 15, stock: 45, status: 'available', description: 'Pão brioche, blend 180g, queijo cheddar, bacon crocante e maionese da casa.' },
        { id: 2, name: 'Batata Rústica', category: 'Entradas', price: 22.00, time: 10, stock: 120, status: 'available', description: 'Batatas fritas com alecrim e alho confitado.' },
        { id: 3, name: 'Petit Gateau', category: 'Sobremesas', price: 28.00, time: 12, stock: 15, status: 'available', description: 'Bolo de chocolate quente com recheio cremoso e sorvete de baunilha.' },
        { id: 4, name: 'Suco de Laranja 500ml', category: 'Bebidas', price: 12.00, time: 5, stock: null, status: 'available', description: 'Suco 100% natural espremido na hora.' },
        { id: 5, name: 'Combo Casal', category: 'Combos', price: 85.00, time: 20, stock: 10, status: 'unavailable', description: '2x Burgers + 1x Batata Família + 2x Refri.' },
    ];

    const filteredItems = selectedCategory === 'Todos' ? menuItems : menuItems.filter(i => i.category === selectedCategory);

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cardápio Digital</h1>
                    <p className="text-muted-foreground">Gerencie seus produtos, preços e categorias.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="font-bold">Gerenciar Categorias</Button>
                    <Button className="font-black gap-2 shadow-lg shadow-primary/20">
                        <Plus size={18} />
                        Novo Produto
                    </Button>
                </div>
            </div>

            {/* Categorias Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                            "px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                            selectedCategory === cat
                                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105"
                                : "bg-white text-muted-foreground border-slate-200 hover:border-primary hover:text-primary"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                        placeholder="Buscar item no cardápio..."
                        className="w-full pl-10 h-11 rounded-xl border bg-background text-sm outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Visualização:</span>
                    <Badge variant="outline" className="bg-slate-50 text-slate-500 font-bold text-[9px] h-7 px-3 uppercase border-slate-200">Grid</Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map(item => (
                    <Card key={item.id} className={cn(
                        "border-none shadow-sm elevated-card group hover:scale-[1.02] transition-all overflow-hidden",
                        item.status === 'unavailable' && "opacity-60 saturate-0"
                    )}>
                        <div className="h-40 bg-slate-100 flex items-center justify-center relative">
                            <ImageIcon size={48} className="text-slate-300" />
                            <Badge className={cn(
                                "absolute top-3 right-3 border-none font-black text-[8px] uppercase tracking-widest px-2 h-5",
                                item.status === 'available' ? 'bg-green-500' : 'bg-red-500'
                            )}>
                                {item.status === 'available' ? 'Disponível' : 'Indisponível'}
                            </Badge>
                            <div className="absolute bottom-3 left-3">
                                <Badge className="bg-white/90 backdrop-blur-sm text-slate-900 border-none font-black text-[10px] h-6 px-2 shadow-sm">
                                    {item.category}
                                </Badge>
                            </div>
                        </div>
                        <CardContent className="p-5 space-y-4">
                            <div>
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-black text-lg leading-tight uppercase line-clamp-1">{item.name}</h3>
                                    <span className="text-lg font-black text-emerald-600">R$ {item.price.toFixed(2)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 h-8 leading-relaxed font-medium">
                                    {item.description}
                                </p>
                            </div>

                            <div className="flex items-center justify-between py-3 border-y border-dashed border-slate-200">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Preparo</span>
                                    <div className="flex items-center gap-1.5 text-xs font-bold">
                                        <Clock size={12} className="text-blue-500" />
                                        {item.time} min
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Estoque</span>
                                    <div className="flex items-center gap-1.5 text-xs font-bold">
                                        {item.stock !== null ? (
                                            <span className={cn(item.stock < 10 ? "text-red-500" : "text-green-600")}>
                                                {item.stock} un
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">∞</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <Button variant="outline" size="sm" className="flex-1 font-black text-[10px] uppercase tracking-widest rounded-lg h-9 hover:bg-slate-50">
                                    <Edit3 size={12} className="mr-2" /> Editar
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:bg-muted rounded-lg">
                                    {item.status === 'available' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg">
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                <button className="h-full min-h-[350px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-4 group hover:border-primary/50 transition-all hover:bg-primary/5">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                        <Plus size={24} />
                    </div>
                    <span className="font-black uppercase tracking-widest text-[10px] text-muted-foreground group-hover:text-primary">Adicionar Item</span>
                </button>
            </div>
        </div>
    );
};

export default CardapioPage;
