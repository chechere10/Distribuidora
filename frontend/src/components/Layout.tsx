import { useState, ReactNode, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Tooltip,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  PointOfSale,
  Inventory2,
  ShoppingCart,
  People,
  Receipt,
  AccountBalance,
  Settings,
  Logout,
  History,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  AssignmentReturn,
} from '@mui/icons-material';
import { removeToken } from '../api';
import { useAuth, OPERARIO_ALLOWED_ROUTES } from '../context/AuthContext';

const drawerWidthExpanded = 200;
const drawerWidthCollapsed = 60;

interface LayoutProps {
  children: ReactNode;
}

const allMenuItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { text: 'Punto de Venta', icon: <PointOfSale />, path: '/pos' },
  { text: 'Historial Ventas', icon: <History />, path: '/sales-history' },
  { text: 'Inventario', icon: <Inventory2 />, path: '/inventory' },
  { text: 'Pedidos', icon: <ShoppingCart />, path: '/orders' },
  { text: 'Fiados', icon: <CreditCard />, path: '/fiados' },
  { text: 'Gastos', icon: <Receipt />, path: '/expenses' },
  { text: 'Devoluciones', icon: <AssignmentReturn />, path: '/returns' },
  { text: 'Contabilidad', icon: <AccountBalance />, path: '/accounting' },
  { text: 'Usuarios', icon: <People />, path: '/users' },
  { text: 'Configuración', icon: <Settings />, path: '/settings' },
];

export default function Layout({ children }: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, user, logout: authLogout } = useAuth();

  // Filtrar menú según el rol del usuario - recalcular cada vez que cambie user.id o user.role
  const menuItems = useMemo(() => {
    console.log('Recalculando menú para usuario:', user?.username, 'rol:', user?.role);
    // Si no hay usuario o es admin, mostrar todo
    if (!user || user.role === 'admin') {
      return allMenuItems;
    }
    // Operarios solo ven las rutas permitidas
    return allMenuItems.filter(item => OPERARIO_ALLOWED_ROUTES.includes(item.path));
  }, [user?.id, user?.role]); // Dependencias específicas

  const drawerWidth = collapsed ? drawerWidthCollapsed : drawerWidthExpanded;

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(collapsed));
  }, [collapsed]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  const handleLogout = () => {
    authLogout();
    removeToken();
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ justifyContent: collapsed ? 'center' : 'space-between', minHeight: '56px !important', px: collapsed ? 0 : 1 }}>
        {!collapsed && (
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1rem' }}>
            ZORA POS
          </Typography>
        )}
        <IconButton onClick={toggleCollapsed} size="small" sx={{ color: 'primary.main' }}>
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, pt: 0 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
            <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  minHeight: 44,
                  justifyContent: collapsed ? 'center' : 'initial',
                  px: collapsed ? 1 : 2,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: 0, 
                  mr: collapsed ? 0 : 2,
                  justifyContent: 'center',
                }}>
                  {item.icon}
                </ListItemIcon>
                {!collapsed && <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.85rem' }} />}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
      <Divider />
      {/* Usuario conectado */}
      {!collapsed && user && (user.name || user.username) && (
        <Box sx={{ p: 1.5, bgcolor: 'grey.100' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: isAdmin ? 'error.main' : 'primary.main', fontSize: '0.8rem' }}>
              {(user.name || user.username || '?').charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="body2" fontWeight="bold" noWrap sx={{ fontSize: '0.8rem' }}>
                {user.name || user.username || 'Usuario'}
              </Typography>
              <Chip 
                label={isAdmin ? 'Admin' : 'Operario'} 
                size="small" 
                color={isAdmin ? 'error' : 'primary'}
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
            </Box>
          </Box>
        </Box>
      )}
      <List>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <Tooltip title={collapsed ? 'Cerrar Sesión' : ''} placement="right" arrow>
            <ListItemButton 
              onClick={handleLogout}
              sx={{
                minHeight: 44,
                justifyContent: collapsed ? 'center' : 'initial',
                px: collapsed ? 1 : 2,
              }}
            >
              <ListItemIcon sx={{ 
                minWidth: 0, 
                mr: collapsed ? 0 : 2,
                justifyContent: 'center',
              }}>
                <Logout />
              </ListItemIcon>
              {!collapsed && <ListItemText primary="Cerrar Sesión" primaryTypographyProps={{ fontSize: '0.85rem' }} />}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          display: { md: 'none' },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            ZORA POS
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ 
          width: { md: drawerWidth }, 
          flexShrink: { md: 0 },
          transition: 'width 0.2s ease-in-out',
        }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidthExpanded },
          }}
        >
          {drawer}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              transition: 'width 0.2s ease-in-out',
              overflowX: 'hidden',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: { xs: 7, md: 0 },
          backgroundColor: 'background.default',
          minHeight: '100vh',
          transition: 'width 0.2s ease-in-out, margin 0.2s ease-in-out',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
