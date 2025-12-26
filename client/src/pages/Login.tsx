import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { User, Lock, Loader2 } from "lucide-react";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            let data: any = {};
            try {
                const text = await res.text();
                data = text ? JSON.parse(text) : {};
            } catch {
                data = {};
            }

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error(data.error || "E-mail ou senha incorretos.");
                }
                throw new Error(data.error || "Falha no login. Tente novamente em alguns instantes.");
            }

            if (!data.token || !data.user) {
                throw new Error("Resposta inesperada do servidor. Tente novamente.");
            }

            login(data.token, data.user);
            navigate("/");
        } catch (err: any) {
            setError(err.message || "Erro ao tentar entrar. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Viamovecar Hub</CardTitle>
                    <CardDescription>Entre com suas credenciais de acesso</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    type="email"
                                    placeholder="Email corporativo"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    type="password"
                                    placeholder="Senha"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        {error && <div className="text-sm text-red-500 text-center">{error}</div>}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Entrar"}
                        </Button>
                        <div className="mt-4 text-center text-xs text-muted-foreground">
                            Ainda não tem acesso?{" "}
                            <button
                                type="button"
                                onClick={() => navigate("/cadastro")}
                                className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                                Cadastre-se
                            </button>
                        </div>
                     </form>
                 </CardContent>
             </Card>
         </div>
     );
 };
 
 export default LoginPage;
