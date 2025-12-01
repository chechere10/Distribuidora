import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getToken } from './api';
import { useAuth, isRouteAllowedForOperario } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Users from './pages/Users';
import Expenses from './pages/Expenses';
import Fiados from './pages/Fiados';
import Accounting from './pages/Accounting';
import SalesHistory from './pages/SalesHistory';
import Settings from './pages/Settings';
import Returns from './pages/Returns';
import Layout from './components/Layout';

// Componente de carga
function LoadingScreen() {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      gap: 2
    }}>
      <CircularProgress size={48} />
      <Typography variant="body1" color="text.secondary">
        Cargando...
      </Typography>
    </Box>
  );
}

// Componente para proteger rutas solo de administrador
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isAuthenticated, isLoading, user } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/pos" replace />;
  }
  
  // Key basada en el usuario para forzar re-render cuando cambia
  return <div key={user?.id || 'admin'}>{children}</div>;
}

// Componente para rutas autenticadas (todos los usuarios)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Key basada en el usuario para forzar re-render cuando cambia
  return <div key={user?.id || 'protected'}>{children}</div>;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    // No hacer nada mientras está cargando
    if (isLoading) return;
    
    if (!getToken()) {
      navigate('/login');
      return;
    }
    
    // Si es operario y está intentando acceder a una ruta no permitida, redirigir a POS
    if (isAuthenticated && !isAdmin && !isRouteAllowedForOperario(location.pathname) && location.pathname !== '/login') {
      navigate('/pos');
    }
  }, [navigate, isAdmin, isAuthenticated, isLoading, location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Rutas permitidas para todos los usuarios autenticados */}
      <Route path="/pos" element={<ProtectedRoute><Layout><POS /></Layout></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Layout><Orders /></Layout></ProtectedRoute>} />
      <Route path="/fiados" element={<ProtectedRoute><Layout><Fiados /></Layout></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><Layout><Expenses /></Layout></ProtectedRoute>} />
      <Route path="/returns" element={<ProtectedRoute><Layout><Returns /></Layout></ProtectedRoute>} />
      
      {/* Rutas solo para administradores */}
      <Route path="/dashboard" element={<AdminRoute><Layout><Dashboard /></Layout></AdminRoute>} />
      <Route path="/sales-history" element={<AdminRoute><Layout><SalesHistory /></Layout></AdminRoute>} />
      <Route path="/products" element={<AdminRoute><Layout><Products /></Layout></AdminRoute>} />
      <Route path="/inventory" element={<AdminRoute><Layout><Inventory /></Layout></AdminRoute>} />
      <Route path="/users" element={<AdminRoute><Layout><Users /></Layout></AdminRoute>} />
      <Route path="/accounting" element={<AdminRoute><Layout><Accounting /></Layout></AdminRoute>} />
      <Route path="/settings" element={<AdminRoute><Layout><Settings /></Layout></AdminRoute>} />
      
      {/* Ruta por defecto */}
      <Route path="/" element={<ProtectedRoute><Layout><POS /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
