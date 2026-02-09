import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CompanySummary } from "../types";
import { useTheme } from "next-themes";

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
    theme?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isLoading: boolean;
    updateUserTheme: (theme: string) => void;

    isAuthenticated: boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { setTheme } = useTheme();

    useEffect(() => {
        // Load from localStorage on mount
        const storedToken = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("auth_user");

        if (storedToken && storedUser) {
            setToken(storedToken);
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            // Restore user theme
            if (parsedUser.theme) {
                setTheme(parsedUser.theme);
            }
        }
        setIsLoading(false);
    }, [setTheme]);

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("auth_user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);

        // Apply user theme preference
        if (newUser.theme) {
            setTheme(newUser.theme);
        } else {
            setTheme('light'); // Default
        }
    };

    const logout = () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setToken(null);
        setUser(null);
        setTheme('light'); // Reset to default on logout
    };

    const updateUserTheme = async (newTheme: string) => {
        if (user) {
            // Optimistic update
            const updatedUser = { ...user, theme: newTheme };
            setUser(updatedUser);
            localStorage.setItem("auth_user", JSON.stringify(updatedUser));
            setTheme(newTheme);

            // Persist to backend
            try {
                await fetch('/api/users/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ theme: newTheme })
                });
            } catch (error) {
                console.error("Failed to persist theme preference", error);
            }
        } else {
            // Guest mode
            setTheme(newTheme);
        }
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
                updateUserTheme,
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
