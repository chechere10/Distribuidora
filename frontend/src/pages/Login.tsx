import { useState, useEffect, useRef } from 'react';
import { api, removeToken } from '../api';
import { 
  Button, 
  TextField, 
  Box, 
  Paper, 
  Typography, 
  Avatar,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Person, Lock, Visibility, VisibilityOff, Store } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const cleanedRef = useRef(false);

  // Al entrar a la página de login, limpiar completamente la sesión anterior
  useEffect(() => {
    if (!cleanedRef.current) {
      cleanedRef.current = true;
      // Limpiar todo el estado de autenticación
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, [setUser]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await api.post<{ token: string; user: { id: string; username: string; name: string; role: 'admin' | 'operario' } }>('/auth/login', { username, password });
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
      // Pequeño delay para asegurar que el estado se propague
      setTimeout(() => navigate('/pos'), 50);
    } catch (err: any) {
      setError(err.message || 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
        p: 2
      }}
    >
      <Paper 
        elevation={10}
        sx={{ 
          p: 4, 
          width: '100%',
          maxWidth: 400,
          borderRadius: 3,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Avatar 
            sx={{ 
              width: 70, 
              height: 70, 
              bgcolor: 'primary.main',
              mb: 2
            }}
          >
            <Store sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" fontWeight="bold" color="primary">
            Zora POS
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sistema de Punto de Venta
          </Typography>
        </Box>

        <form onSubmit={onSubmit}>
          <TextField 
            label="Usuario" 
            fullWidth 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            sx={{ mb: 2 }}
            autoComplete="username"
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField 
            label="Contraseña" 
            type={showPassword ? 'text' : 'password'} 
            fullWidth 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            sx={{ mb: 2 }}
            autoComplete="current-password"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Button 
            type="submit" 
            variant="contained" 
            fullWidth 
            size="large"
            disabled={loading}
            sx={{ 
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Ingresar'}
          </Button>
        </form>

        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ display: 'block', textAlign: 'center', mt: 3 }}
        >
          © 2024 Zora POS - Todos los derechos reservados
        </Typography>
      </Paper>
    </Box>
  );
}


