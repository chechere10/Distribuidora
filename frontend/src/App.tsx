import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { getToken } from './api';
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
import Layout from './components/Layout';

export default function App() {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!getToken()) navigate('/login');
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
      <Route path="/pos" element={<Layout><POS /></Layout>} />
      <Route path="/sales-history" element={<Layout><SalesHistory /></Layout>} />
      <Route path="/products" element={<Layout><Products /></Layout>} />
      <Route path="/inventory" element={<Layout><Inventory /></Layout>} />
      <Route path="/orders" element={<Layout><Orders /></Layout>} />
      <Route path="/fiados" element={<Layout><Fiados /></Layout>} />
      <Route path="/users" element={<Layout><Users /></Layout>} />
      <Route path="/expenses" element={<Layout><Expenses /></Layout>} />
      <Route path="/accounting" element={<Layout><Accounting /></Layout>} />
      <Route path="/settings" element={<Layout><Settings /></Layout>} />
      <Route path="/" element={<Layout><Dashboard /></Layout>} />
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
