import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Avatar,
  Divider,
  CircularProgress,
  Snackbar,
  Paper,
  useTheme,
  alpha,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ListItemButton,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Backup,
  Restore,
  Schedule,
  Folder,
  CloudUpload,
  CloudDownload,
  Delete,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Storage,
  AccessTime,
  CalendarToday,
  Info,
  PlayArrow,
  Stop,
  Refresh,
  Settings as SettingsIcon,
  Security,
  History,
  FolderOpen,
  Save,
  UploadFile,
  DownloadDone,
  UsbOutlined,
  Computer,
  ArrowBack,
  CreateNewFolder,
  NavigateNext,
} from '@mui/icons-material';
import { api } from '../api';

// ============ INTERFACES ============
interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
  type: 'manual' | 'automatic';
  status: 'completed' | 'failed';
  path: string;
}

interface BackupConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  maxBackups: number;
  backupPath: string;
  lastBackup?: string;
  nextBackup?: string;
}

interface SystemInfo {
  dbSize: string;
  totalProducts: number;
  totalSales: number;
  totalCustomers: number;
  lastBackup: string | null;
  backupCount: number;
}

interface MountPoint {
  path: string;
  device: string;
  type: string;
  size: string;
  available: string;
  label: string;
}

interface BrowseItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface BrowseResult {
  currentPath: string;
  parentPath: string;
  items: BrowseItem[];
}

// ============ COMPONENTE PRINCIPAL ============
export default function Settings() {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [config, setConfig] = useState<BackupConfig>({
    enabled: false,
    frequency: 'daily',
    time: '03:00',
    maxBackups: 7,
    backupPath: '/backups',
  });
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  // Estados de operaciones
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  
  // Diálogos
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [customPath, setCustomPath] = useState('');
  
  // Estados del explorador de archivos
  const [mountPoints, setMountPoints] = useState<MountPoint[]>([]);
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [pathValid, setPathValid] = useState<{ valid: boolean; message: string } | null>(null);
  const [checkingPath, setCheckingPath] = useState(false);

  // ============ CARGAR DATOS ============
  const loadData = async () => {
    setLoading(true);
    try {
      const [backupsData, configData, infoData] = await Promise.all([
        api.get<BackupInfo[]>('/backup/list').catch(() => []),
        api.get<BackupConfig>('/backup/config').catch(() => config),
        api.get<SystemInfo>('/backup/system-info').catch(() => null),
      ]);
      setBackups(backupsData);
      if (configData) setConfig(configData);
      setSystemInfo(infoData);
    } catch (error) {
      console.error('Error loading backup data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ============ HANDLERS ============
  
  // Crear backup manual
  const handleCreateBackup = async (externalPath?: string) => {
    setBackupInProgress(true);
    setBackupProgress(0);
    
    try {
      // Simular progreso
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => Math.min(prev + 10, 90));
      }, 500);
      
      const response = await api.post<{ success: boolean; backup: BackupInfo; message: string }>(
        '/backup/create',
        { path: externalPath || config.backupPath }
      );
      
      clearInterval(progressInterval);
      setBackupProgress(100);
      
      if (response.success) {
        setSnackbar({ 
          open: true, 
          message: '✅ Copia de seguridad creada exitosamente', 
          severity: 'success' 
        });
        loadData();
      }
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || 'Error al crear copia de seguridad', 
        severity: 'error' 
      });
    } finally {
      setBackupInProgress(false);
      setBackupProgress(0);
    }
  };

  // Restaurar backup
  const handleRestore = async () => {
    if (!selectedBackup) return;
    
    setRestoreInProgress(true);
    setRestoreProgress(0);
    setConfirmRestoreOpen(false);
    
    try {
      // Simular progreso
      const progressInterval = setInterval(() => {
        setRestoreProgress(prev => Math.min(prev + 5, 90));
      }, 300);
      
      const response = await api.post<{ success: boolean; message: string }>(
        '/backup/restore',
        { backupId: selectedBackup.id, filename: selectedBackup.filename }
      );
      
      clearInterval(progressInterval);
      setRestoreProgress(100);
      
      if (response.success) {
        setSnackbar({ 
          open: true, 
          message: '✅ Sistema restaurado exitosamente. La página se recargará.', 
          severity: 'success' 
        });
        
        // Recargar después de 2 segundos
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || 'Error al restaurar sistema', 
        severity: 'error' 
      });
    } finally {
      setRestoreInProgress(false);
      setRestoreProgress(0);
      setRestoreDialogOpen(false);
      setSelectedBackup(null);
    }
  };

  // Subir archivo de backup externo
  const handleUploadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.sql') && !file.name.endsWith('.backup') && !file.name.endsWith('.dump')) {
      setSnackbar({ 
        open: true, 
        message: 'Formato de archivo no válido. Use .sql, .backup o .dump', 
        severity: 'error' 
      });
      return;
    }
    
    setRestoreInProgress(true);
    setRestoreProgress(0);
    
    try {
      const progressInterval = setInterval(() => {
        setRestoreProgress(prev => Math.min(prev + 5, 90));
      }, 300);
      
      const response = await api.upload<{ success: boolean; message: string }>(
        '/backup/upload-and-restore',
        file
      );
      
      clearInterval(progressInterval);
      setRestoreProgress(100);
      
      if (response.success) {
        setSnackbar({ 
          open: true, 
          message: '✅ Backup subido y sistema restaurado. La página se recargará.', 
          severity: 'success' 
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || 'Error al subir y restaurar backup', 
        severity: 'error' 
      });
    } finally {
      setRestoreInProgress(false);
      setRestoreProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Descargar backup
  const handleDownloadBackup = async (backup: BackupInfo) => {
    try {
      const response = await fetch(`http://localhost:3001/api/backup/download/${backup.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Error al descargar');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSnackbar({ open: true, message: 'Descarga iniciada', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al descargar backup', severity: 'error' });
    }
  };

  // Eliminar backup
  const handleDeleteBackup = async (backup: BackupInfo) => {
    if (!confirm(`¿Eliminar la copia de seguridad "${backup.filename}"?`)) return;
    
    try {
      await api.delete(`/backup/${backup.id}`);
      setSnackbar({ open: true, message: 'Backup eliminado', severity: 'success' });
      loadData();
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al eliminar backup', severity: 'error' });
    }
  };

  // Guardar configuración
  const handleSaveConfig = async () => {
    try {
      await api.post('/backup/config', config);
      setSnackbar({ open: true, message: 'Configuración guardada', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al guardar configuración', severity: 'error' });
    }
  };

  // Backup a ubicación externa
  const handleExternalBackup = async () => {
    setPathDialogOpen(true);
    setCustomPath('/');
    setPathValid(null);
    // Iniciar navegación desde la raíz
    handleBrowsePath('/');
  };

  // Navegar a un directorio
  const handleBrowsePath = async (path: string) => {
    setBrowsing(true);
    try {
      const result = await api.get<BrowseResult>(`/system/browse?path=${encodeURIComponent(path)}`);
      setBrowseResult(result);
      setCustomPath(result.currentPath);
    } catch (error) {
      console.error('Error browsing path:', error);
    } finally {
      setBrowsing(false);
    }
  };

  // Verificar ruta personalizada
  const handleCheckPath = async () => {
    if (!customPath) return;
    setCheckingPath(true);
    try {
      const result = await api.post<{ valid: boolean; message: string }>('/system/check-path', { path: customPath });
      setPathValid(result);
    } catch (error) {
      setPathValid({ valid: false, message: 'Error al verificar la ruta' });
    } finally {
      setCheckingPath(false);
    }
  };

  // Seleccionar punto de montaje
  const handleSelectMountPoint = (mount: MountPoint) => {
    setCustomPath(mount.path);
    handleBrowsePath(mount.path);
  };

  const confirmExternalBackup = () => {
    if (customPath) {
      handleCreateBackup(customPath);
    }
    setPathDialogOpen(false);
  };

  // Formatear tamaño
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Formatear fecha
  const formatDate = (date: string): string => {
    return new Date(date).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon fontSize="large" />
          Configuración
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Gestiona copias de seguridad y restauración del sistema
        </Typography>
      </Box>

      {/* Información del Sistema */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                <Storage />
              </Avatar>
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  {systemInfo?.dbSize || '0 MB'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tamaño Base de Datos
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                <Backup />
              </Avatar>
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  {backups.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Copias Disponibles
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                <AccessTime />
              </Avatar>
              <Box>
                <Typography variant="body1" fontWeight="bold" noWrap>
                  {systemInfo?.lastBackup ? formatDate(systemInfo.lastBackup) : 'Nunca'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Última Copia
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'info.main', width: 56, height: 56 }}>
                <Security />
              </Avatar>
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  {config.enabled ? 'Activo' : 'Inactivo'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Backup Automático
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Panel de Acciones Rápidas */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Backup color="primary" />
              Copias de Seguridad
            </Typography>

            {/* Progreso de Backup */}
            {backupInProgress && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Creando copia de seguridad...
                </Typography>
                <LinearProgress variant="determinate" value={backupProgress} sx={{ height: 8, borderRadius: 4 }} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
                  {backupProgress}%
                </Typography>
              </Box>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<Backup />}
                  onClick={() => handleCreateBackup()}
                  disabled={backupInProgress || restoreInProgress}
                  sx={{ py: 2 }}
                >
                  Crear Copia Ahora
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  startIcon={<FolderOpen />}
                  onClick={handleExternalBackup}
                  disabled={backupInProgress || restoreInProgress}
                  sx={{ py: 2 }}
                >
                  Guardar en USB/Disco
                </Button>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Restore color="secondary" />
              Restaurar Sistema
            </Typography>

            {/* Progreso de Restauración */}
            {restoreInProgress && (
              <Box sx={{ mb: 3 }}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  ⚠️ No cierre esta ventana. Restaurando sistema...
                </Alert>
                <LinearProgress variant="determinate" value={restoreProgress} color="warning" sx={{ height: 8, borderRadius: 4 }} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
                  {restoreProgress}%
                </Typography>
              </Box>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="contained"
                  color="warning"
                  size="large"
                  startIcon={<History />}
                  onClick={() => setRestoreDialogOpen(true)}
                  disabled={backupInProgress || restoreInProgress || backups.length === 0}
                  sx={{ py: 2 }}
                >
                  Restaurar Backup
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  size="large"
                  startIcon={<UploadFile />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={backupInProgress || restoreInProgress}
                  sx={{ py: 2 }}
                >
                  Subir Archivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept=".sql,.backup,.dump"
                  onChange={handleUploadBackup}
                />
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 3 }}>
              <strong>Importante:</strong> Al restaurar se reemplazarán TODOS los datos actuales con los del backup seleccionado.
            </Alert>
          </Paper>
        </Grid>

        {/* Panel de Configuración Automática */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="primary" />
              Backup Automático
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography fontWeight="medium">
                    {config.enabled ? 'Activado' : 'Desactivado'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Crear copias de seguridad automáticamente
                  </Typography>
                </Box>
              }
              sx={{ mb: 3 }}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Frecuencia</InputLabel>
                  <Select
                    value={config.frequency}
                    onChange={(e) => setConfig({ ...config, frequency: e.target.value as any })}
                    label="Frecuencia"
                    disabled={!config.enabled}
                  >
                    <MenuItem value="hourly">Cada hora</MenuItem>
                    <MenuItem value="daily">Diario</MenuItem>
                    <MenuItem value="weekly">Semanal</MenuItem>
                    <MenuItem value="monthly">Mensual</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Hora del backup"
                  type="time"
                  value={config.time}
                  onChange={(e) => setConfig({ ...config, time: e.target.value })}
                  disabled={!config.enabled || config.frequency === 'hourly'}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              {config.frequency === 'weekly' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Día de la semana</InputLabel>
                    <Select
                      value={config.dayOfWeek || 0}
                      onChange={(e) => setConfig({ ...config, dayOfWeek: e.target.value as number })}
                      label="Día de la semana"
                      disabled={!config.enabled}
                    >
                      <MenuItem value={0}>Domingo</MenuItem>
                      <MenuItem value={1}>Lunes</MenuItem>
                      <MenuItem value={2}>Martes</MenuItem>
                      <MenuItem value={3}>Miércoles</MenuItem>
                      <MenuItem value={4}>Jueves</MenuItem>
                      <MenuItem value={5}>Viernes</MenuItem>
                      <MenuItem value={6}>Sábado</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              
              {config.frequency === 'monthly' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Día del mes"
                    type="number"
                    value={config.dayOfMonth || 1}
                    onChange={(e) => setConfig({ ...config, dayOfMonth: parseInt(e.target.value) })}
                    disabled={!config.enabled}
                    inputProps={{ min: 1, max: 28 }}
                  />
                </Grid>
              )}
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Máximo de copias a conservar"
                  type="number"
                  value={config.maxBackups}
                  onChange={(e) => setConfig({ ...config, maxBackups: parseInt(e.target.value) })}
                  disabled={!config.enabled}
                  inputProps={{ min: 1, max: 30 }}
                  helperText="Las copias más antiguas se eliminarán automáticamente"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Ruta de almacenamiento"
                  value={config.backupPath}
                  onChange={(e) => setConfig({ ...config, backupPath: e.target.value })}
                  disabled={!config.enabled}
                  placeholder="/home/usuario/Documentos/backups"
                  helperText="Ruta donde se guardarán las copias automáticas"
                  InputProps={{
                    endAdornment: (
                      <IconButton
                        onClick={() => {
                          setPathDialogOpen(true);
                          setCustomPath(config.backupPath || '/');
                          setPathValid(null);
                          // Iniciar navegación desde la ruta actual o desde /
                          handleBrowsePath(config.backupPath || '/');
                        }}
                        disabled={!config.enabled}
                        edge="end"
                        title="Explorar carpetas"
                      >
                        <FolderOpen />
                      </IconButton>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSaveConfig}
              >
                Guardar Configuración
              </Button>
            </Box>

            {config.enabled && config.nextBackup && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <strong>Próximo backup:</strong> {formatDate(config.nextBackup)}
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Lista de Backups */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <History color="primary" />
                Historial de Copias de Seguridad
              </Typography>
              <IconButton onClick={loadData}>
                <Refresh />
              </IconButton>
            </Box>

            {backups.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Backup sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
                <Typography color="text.secondary">
                  No hay copias de seguridad disponibles
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Crea tu primera copia de seguridad para proteger tus datos
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Archivo</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Tamaño</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {backups.map((backup) => (
                      <TableRow key={backup.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Storage color="primary" />
                            <Typography fontFamily="monospace" variant="body2">
                              {backup.filename}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={backup.type === 'automatic' ? 'Automático' : 'Manual'}
                            size="small"
                            color={backup.type === 'automatic' ? 'info' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{formatSize(backup.size)}</TableCell>
                        <TableCell>{formatDate(backup.createdAt)}</TableCell>
                        <TableCell>
                          <Chip
                            label={backup.status === 'completed' ? 'Completado' : 'Fallido'}
                            size="small"
                            color={backup.status === 'completed' ? 'success' : 'error'}
                            icon={backup.status === 'completed' ? <CheckCircle /> : <ErrorIcon />}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Descargar">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleDownloadBackup(backup)}
                            >
                              <CloudDownload />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Restaurar">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => {
                                setSelectedBackup(backup);
                                setConfirmRestoreOpen(true);
                              }}
                            >
                              <Restore />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteBackup(backup)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Diálogo de Selección de Backup para Restaurar */}
      <Dialog
        open={restoreDialogOpen}
        onClose={() => setRestoreDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Restore color="warning" />
          Seleccionar Backup para Restaurar
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            ⚠️ Esta acción reemplazará TODOS los datos actuales del sistema con los del backup seleccionado.
            Este proceso no se puede deshacer.
          </Alert>
          <List>
            {backups.map((backup) => (
              <ListItem
                key={backup.id}
                onClick={() => setSelectedBackup(backup)}
                sx={{
                  border: '1px solid',
                  borderColor: selectedBackup?.id === backup.id ? 'warning.main' : 'grey.300',
                  borderRadius: 1,
                  mb: 1,
                  cursor: 'pointer',
                  bgcolor: selectedBackup?.id === backup.id ? alpha(theme.palette.warning.main, 0.1) : 'transparent',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.warning.main, 0.05),
                  },
                }}
              >
                <ListItemIcon>
                  <Storage color={selectedBackup?.id === backup.id ? 'warning' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={backup.filename}
                  secondary={`${formatSize(backup.size)} • ${formatDate(backup.createdAt)}`}
                />
                {selectedBackup?.id === backup.id && (
                  <CheckCircle color="warning" />
                )}
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              setRestoreDialogOpen(false);
              setConfirmRestoreOpen(true);
            }}
            disabled={!selectedBackup}
          >
            Continuar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Confirmación de Restauración */}
      <Dialog
        open={confirmRestoreOpen}
        onClose={() => setConfirmRestoreOpen(false)}
      >
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" />
          ¿Confirmar Restauración?
        </DialogTitle>
        <DialogContent>
          <Typography paragraph>
            Estás a punto de restaurar el sistema desde:
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'grey.100', mb: 2 }}>
            <Typography fontWeight="bold">{selectedBackup?.filename}</Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedBackup && formatDate(selectedBackup.createdAt)} • {selectedBackup && formatSize(selectedBackup.size)}
            </Typography>
          </Paper>
          <Alert severity="error">
            <strong>¡ATENCIÓN!</strong> Esta acción:
            <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
              <li>Eliminará TODOS los datos actuales</li>
              <li>Restaurará los datos del backup seleccionado</li>
              <li>NO se puede deshacer</li>
            </ul>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRestoreOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRestore}
            startIcon={<Restore />}
          >
            Sí, Restaurar Sistema
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Explorador de Carpetas */}
      <Dialog
        open={pathDialogOpen}
        onClose={() => setPathDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderOpen color="primary" />
          Seleccionar Carpeta
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Navega y selecciona la carpeta donde deseas guardar los backups.
          </Typography>
          
          {/* Explorador de carpetas */}
          {browseResult && (
            <Box>
              {/* Barra de navegación */}
              <Paper sx={{ p: 1, mb: 2, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton 
                  size="small" 
                  onClick={() => handleBrowsePath(browseResult.parentPath)}
                  disabled={browseResult.currentPath === '/'}
                  title="Subir un nivel"
                >
                  <ArrowBack fontSize="small" />
                </IconButton>
                <IconButton 
                  size="small" 
                  onClick={() => handleBrowsePath('/')}
                  title="Ir a la raíz"
                >
                  <Computer fontSize="small" />
                </IconButton>
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ flex: 1, overflow: 'hidden' }}>
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => handleBrowsePath('/')}
                    sx={{ cursor: 'pointer' }}
                  >
                    /
                  </Link>
                  {browseResult.currentPath.split('/').filter(Boolean).map((part, index, arr) => (
                    <Link
                      key={index}
                      component="button"
                      variant="body2"
                      onClick={() => handleBrowsePath('/' + arr.slice(0, index + 1).join('/'))}
                      sx={{ cursor: 'pointer', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {part}
                    </Link>
                  ))}
                </Breadcrumbs>
              </Paper>

              {/* Ruta actual seleccionada */}
              <Paper sx={{ p: 1.5, mb: 2, border: '2px solid', borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <Typography variant="caption" color="text.secondary">
                  Carpeta seleccionada:
                </Typography>
                <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                  {customPath || '/'}
                </Typography>
              </Paper>
              
              {/* Lista de carpetas */}
              <Paper variant="outlined" sx={{ maxHeight: 350, overflow: 'auto' }}>
                {browsing ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Cargando carpetas...
                    </Typography>
                  </Box>
                ) : browseResult.items.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Folder sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Esta carpeta no tiene subcarpetas
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Puedes usar esta carpeta para guardar los backups
                    </Typography>
                  </Box>
                ) : (
                  <List dense disablePadding>
                    {browseResult.items.map((item) => (
                      <ListItemButton
                        key={item.path}
                        onClick={() => handleBrowsePath(item.path)}
                        sx={{ 
                          borderBottom: '1px solid',
                          borderColor: 'grey.200',
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          {item.name.toLowerCase().includes('usb') || item.name.toLowerCase().includes('media') ? (
                            <UsbOutlined color="secondary" />
                          ) : item.name === 'home' || item.name === 'Documentos' || item.name === 'Documents' ? (
                            <Folder color="primary" />
                          ) : (
                            <Folder color="warning" />
                          )}
                        </ListItemIcon>
                        <ListItemText 
                          primary={item.name}
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <NavigateNext color="action" fontSize="small" />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Paper>

              {/* Botón para crear nueva carpeta */}
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<CreateNewFolder />}
                  onClick={async () => {
                    const name = prompt('Nombre de la nueva carpeta:');
                    if (name && name.trim()) {
                      const newPath = `${customPath}/${name.trim()}`.replace('//', '/');
                      try {
                        const result = await api.post<{ valid: boolean; message: string }>('/system/check-path', { path: newPath });
                        if (result.valid) {
                          setSnackbar({ open: true, message: `Carpeta "${name}" creada`, severity: 'success' });
                          handleBrowsePath(newPath);
                        } else {
                          setSnackbar({ open: true, message: result.message, severity: 'error' });
                        }
                      } catch (error) {
                        setSnackbar({ open: true, message: 'Error al crear la carpeta', severity: 'error' });
                      }
                    }
                  }}
                >
                  Nueva Carpeta
                </Button>
              </Box>
            </Box>
          )}
          
          {/* Loading inicial */}
          {!browseResult && browsing && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Cargando explorador...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPathDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (customPath) {
                setConfig({ ...config, backupPath: customPath });
                setPathDialogOpen(false);
                setSnackbar({ open: true, message: `Ruta seleccionada: ${customPath}`, severity: 'success' });
              }
            }}
            disabled={!customPath}
            startIcon={<CheckCircle />}
          >
            Seleccionar esta Carpeta
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
