
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
    featureFlags: Record<string, boolean>;
    refreshFeatureFlags: () => Promise<void>;

    isAuthenticated: boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const { setTheme } = useTheme();

    // Feature flag logic
    const fetchFlags = async (authToken: string, companyId: number) => {
        try {
            const res = await fetch(`/api/companies/${companyId}/features`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFeatureFlags(data);
                localStorage.setItem("feature_flags", JSON.stringify(data));
            }
        } catch (e) {
            console.error("Error fetching feature flags in AuthContext", e);
        }
    };

    useEffect(() => {
        // Load from localStorage on mount
        const storedToken = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("auth_user");
        const storedFlags = localStorage.getItem("feature_flags");

        if (storedToken && storedUser) {
            setToken(storedToken);
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            // Restore user theme
            if (parsedUser.theme) {
                setTheme(parsedUser.theme);
            }

            if (storedFlags) {
                try {
                    setFeatureFlags(JSON.parse(storedFlags));
                } catch (e) { }
            }

            // Background refresh flags
            if (parsedUser.company_id) {
                fetchFlags(storedToken, parsedUser.company_id);
            }
        }
        setIsLoading(false);
    }, [setTheme]);

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("auth_user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);

        if (newUser.company_id) {
            fetchFlags(newToken, newUser.company_id);
        }

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
        localStorage.removeItem("feature_flags");
        setToken(null);
        setUser(null);
        setFeatureFlags({});
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
        const storedUser = localStorage.getItem("auth_user");
        if (storedUser) setUser(JSON.parse(storedUser));
    };

    const refreshFeatureFlags = async () => {
        if (token && user?.company_id) {
            await fetchFlags(token, user.company_id);
        }
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
                featureFlags,
                refreshFeatureFlags,
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
