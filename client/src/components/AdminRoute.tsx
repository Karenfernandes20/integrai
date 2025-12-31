import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface AdminRouteProps {
    roles: string[];
}

const AdminRoute = ({ roles }: AdminRouteProps) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <div>Carregando...</div>;
    }

    if (!user) {
        const isSuperRoute = roles.includes('SUPERADMIN') && roles.length === 1;
        return <Navigate to={isSuperRoute ? "/superlogin" : "/login"} replace />;
    }

    if (!roles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default AdminRoute;
