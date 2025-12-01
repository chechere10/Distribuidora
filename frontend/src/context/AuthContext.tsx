import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, getToken } from '../api';

interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'operario';
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!user;

  // Función para establecer el usuario (siempre crea un nuevo objeto para forzar re-render)
  const setUser = (newUser: User | null) => {
    if (newUser) {
      // Crear nuevo objeto para garantizar que React detecte el cambio
      setUserState({ ...newUser });
    } else {
      setUserState(null);
    }
  };

  // Función para refrescar los datos del usuario desde el servidor
  const refreshUser = async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    
    try {
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error refreshing user:', error);
      // Si hay error (token inválido), limpiar sesión
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  // Al cargar la app, verificar el usuario desde el servidor
  useEffect(() => {
    const token = getToken();
    if (token) {
      // Si hay token, obtener datos frescos del servidor
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isAuthenticated, isLoading, setUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Rutas permitidas para operarios (no administradores)
export const OPERARIO_ALLOWED_ROUTES = ['/pos', '/orders', '/fiados', '/expenses', '/returns'];

// Función helper para verificar si una ruta está permitida para operarios
export function isRouteAllowedForOperario(path: string): boolean {
  return OPERARIO_ALLOWED_ROUTES.includes(path);
}
