import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="h-9 w-9" />;

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
            className="rounded-full transition-all duration-300 hover:bg-primary/10"
        >
            {theme === "dark" ? (
                <Sun className="h-[1.2rem] w-[1.2rem] text-amber-400 transition-all" />
            ) : (
                <Moon className="h-[1.2rem] w-[1.2rem] text-slate-700 transition-all" />
            )}
            <span className="sr-only">Alternar tema</span>
        </Button>
    );
}
