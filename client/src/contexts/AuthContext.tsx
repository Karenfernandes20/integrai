import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CompanySummary } from "../types";

interface User {
    id: number | string; // Supporting 'superadmin-fixed' string IDs
    full_name: string;
    email: string;
    phone?: string;
    role: "SUPERADMIN" | "ADMIN" | "USUARIO";
    email_validated: boolean;
    user_type: string;
    company_id?: number;
    company?: CompanySummary;
    profile_pic_url?: string;
    permissions?: string[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isLoading: boolean;

    isAuthenticated: boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load from localStorage on mount
        const storedToken = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("auth_user");

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("auth_user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setToken(null);
        setUser(null);
    };

    const refreshUser = async () => {
        // Implement logic to re-fetch user profile if needed, or parse existing token?
        // Since we store User in LocalStorage, 'refresh' implies fetching latest data from format.
        // For now, we can just save current user back to update timestamps if changed locally, 
        // OR better: Assume the caller might update 'user' state via login() again if they have new data.

        // Actually, to truly refresh, we would need an endpoint /me.
        // MOCK for now: just reread LS
        const storedUser = localStorage.getItem("auth_user");
        if (storedUser) setUser(JSON.parse(storedUser));
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                login,
                logout,
                isLoading,
                isAuthenticated: !!user,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
