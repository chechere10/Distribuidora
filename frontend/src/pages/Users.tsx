import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Paper,
  InputAdornment
} from '@mui/material';
import {
  Add,
  Edit,
  Search,
  Person,
  AdminPanelSettings,
  Block,
  CheckCircle,
  Visibility,
  VisibilityOff,
  Refresh
} from '@mui/icons-material';
import { api } from '../api';

interface User {
  id: string;
  username: string;
  name: string | null;
  role: 'admin' | 'operario';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

const roleConfig: Record<string, { label: string; color: 'error' | 'primary'; icon: React.ReactNode }> = {
  admin: { label: 'Administrador', color: 'error', icon: <AdminPanelSettings /> },
  operario: { label: 'Operario', color: 'primary', icon: <Person /> }
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    role: 'operario' as User['role'],
    isActive: true
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get<User[]>('/users');
      setUsers(data);
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al cargar usuarios', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         user.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        name: user.name || '',
        password: '',
        role: user.role,
        isActive: user.isActive
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        name: '',
        password: '',
        role: 'operario',
        isActive: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleSaveUser = async () => {
    if (!formData.username.trim()) {
      setSnackbar({ open: true, message: 'El usuario es requerido', severity: 'error' });
      return;
    }
    if (!editingUser && !formData.password) {
      setSnackbar({ open: true, message: 'La contraseña es requerida', severity: 'error' });
      return;
    }

    try {
      setSaving(true);
      
      const payload: any = {
        username: formData.username.trim(),
        name: formData.name.trim() || null,
        role: formData.role,
        isActive: formData.isActive
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, payload);
        setSnackbar({ open: true, message: 'Usuario actualizado', severity: 'success' });
      } else {
        await api.post('/users', payload);
        setSnackbar({ open: true, message: 'Usuario creado', severity: 'success' });
      }
      
      handleCloseDialog();
      loadUsers();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || 'Error al guardar', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      setSnackbar({ 
        open: true, 
        message: `Usuario ${!user.isActive ? 'activado' : 'desactivado'}`, 
        severity: 'success' 
      });
      loadUsers();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || 'Error al cambiar estado', severity: 'error' });
    }
  };

  const getUserStats = () => {
    return {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      admins: users.filter(u => u.role === 'admin').length,
      operarios: users.filter(u => u.role === 'operario').length
    };
  };

  const stats = getUserStats();

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Gestión de Usuarios
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Administra usuarios y roles del sistema
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={loadUsers}>
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            sx={{ borderRadius: 2 }}
          >
            Agregar Usuario
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Person sx={{ color: 'primary.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {stats.total}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Usuarios
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CheckCircle sx={{ color: 'success.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {stats.active}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Activos
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AdminPanelSettings sx={{ color: 'error.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {stats.admins}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Administradores
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Person sx={{ color: 'primary.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {stats.operarios}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Operarios
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Buscar por nombre o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Rol</InputLabel>
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                label="Rol"
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="admin">Administrador</MenuItem>
                <MenuItem value="operario">Operario</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Users Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Usuario</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Rol</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Creado</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <Person sx={{ fontSize: 60, color: 'grey.400', mb: 1 }} />
                    <Typography color="text.secondary">No se encontraron usuarios</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const roleInfo = roleConfig[user.role] || roleConfig.operario;
                  return (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: user.isActive ? 'primary.main' : 'grey.400' }}>
                            {user.username.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {user.username}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{user.name || '-'}</TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={roleInfo.icon as React.ReactElement}
                          label={roleInfo.label}
                          color={roleInfo.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={user.isActive ? <CheckCircle /> : <Block />}
                          label={user.isActive ? 'Activo' : 'Inactivo'}
                          color={user.isActive ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          onClick={() => handleOpenDialog(user)}
                          size="small"
                          color="primary"
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          onClick={() => handleToggleUserStatus(user)}
                          size="small"
                          color={user.isActive ? 'error' : 'success'}
                        >
                          {user.isActive ? <Block /> : <CheckCircle />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Editar Usuario' : 'Agregar Usuario'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Usuario"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                autoComplete="off"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person color="action" />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre Completo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={editingUser ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña'}
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                  label="Rol"
                >
                  <MenuItem value="admin">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AdminPanelSettings color="error" fontSize="small" />
                      Administrador
                    </Box>
                  </MenuItem>
                  <MenuItem value="operario">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Person color="primary" fontSize="small" />
                      Operario
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Usuario Activo"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Roles:</strong><br />
                  • <strong>Administrador:</strong> Acceso total al sistema<br />
                  • <strong>Operario:</strong> Acceso a ventas e inventario
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button 
            onClick={handleSaveUser} 
            variant="contained"
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : (editingUser ? 'Actualizar' : 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
