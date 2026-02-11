
import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Calendar, Filter, X, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "./ui/dropdown-menu";

interface DashboardDateFilterProps {
    onApply: (start: string, end: string) => void;
    onClear: () => void;
    initialStart?: string;
    initialEnd?: string;
}

export const DashboardDateFilter = ({
    onApply,
    onClear,
    initialStart,
    initialEnd
}: DashboardDateFilterProps) => {
    const [startDate, setStartDate] = useState(initialStart || "");
    const [endDate, setEndDate] = useState(initialEnd || "");

    useEffect(() => {
        if (initialStart) setStartDate(initialStart);
        if (initialEnd) setEndDate(initialEnd);
    }, [initialStart, initialEnd]);

    const handleQuickFilter = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        setStartDate(startStr);
        setEndDate(endStr);
        onApply(startStr, endStr);
    };

    const handleThisMonth = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date();

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        setStartDate(startStr);
        setEndDate(endStr);
        onApply(startStr, endStr);
    };

    const handleLastMonth = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        setStartDate(startStr);
        setEndDate(endStr);
        onApply(startStr, endStr);
    };

    const handleClear = () => {
        setStartDate("");
        setEndDate("");
        onClear();
    };

    return (
        <div className="flex flex-col sm:flex-row items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1.5 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-9 pl-8 text-xs bg-transparent border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary/20 transition-all font-medium"
                    />
                </div>
                <span className="text-zinc-400 text-xs font-bold">até</span>
                <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-9 pl-8 text-xs bg-transparent border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary/20 transition-all font-medium"
                    />
                </div>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Button
                    variant="default"
                    size="sm"
                    onClick={() => onApply(startDate, endDate)}
                    className="h-9 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95"
                >
                    Aplicar
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 px-2 text-xs font-medium border-zinc-200 dark:border-zinc-800">
                            <Filter className="h-3.5 w-3.5 mr-1.5 text-zinc-500" />
                            Períodos
                            <ChevronDown className="h-3 w-3 ml-1.5 text-zinc-400" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xl">
                        <DropdownMenuItem className="text-xs cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-800" onClick={() => handleQuickFilter(0)}>Hoje</DropdownMenuItem>
                        <DropdownMenuItem className="text-xs cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-800" onClick={() => handleQuickFilter(1)}>Ontem</DropdownMenuItem>
                        <DropdownMenuItem className="text-xs cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-800" onClick={() => handleQuickFilter(7)}>Últimos 7 dias</DropdownMenuItem>
                        <DropdownMenuItem className="text-xs cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-800" onClick={() => handleQuickFilter(30)}>Últimos 30 dias</DropdownMenuItem>
                        <DropdownMenuItem className="text-xs cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-800" onClick={handleThisMonth}>Este mês</DropdownMenuItem>
                        <DropdownMenuItem className="text-xs cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-800" onClick={handleLastMonth}>Mês passado</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {(startDate || endDate) && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClear}
                        className="h-9 w-9 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        title="Limpar filtros"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};
