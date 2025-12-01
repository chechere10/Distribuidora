import { FastifyPluginAsync } from 'fastify';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

// Variable para el intervalo del scheduler
let backupSchedulerInterval: NodeJS.Timeout | null = null;

// Directorio de backups dentro del contenedor
const BACKUP_DIR = process.env.BACKUP_DIR || '/app/backups';
const DB_HOST = process.env.DATABASE_HOST || 'db';
const DB_PORT = process.env.DATABASE_PORT || '5432';
const DB_NAME = process.env.DATABASE_NAME || 'zora';
const DB_USER = process.env.DATABASE_USER || 'postgres';
const DB_PASSWORD = process.env.DATABASE_PASSWORD || 'postgres';

// Convertir ruta del host a ruta del container
function hostPathToContainerPath(hostPath: string): string {
  // Si ya es una ruta del container, devolverla tal cual
  if (hostPath.startsWith('/app/') || hostPath.startsWith('/host/')) {
    return hostPath;
  }
  // Convertir rutas del host: /home -> /host/home, /media -> /host/media, etc.
  if (hostPath.startsWith('/home/')) {
    return '/host' + hostPath;
  }
  if (hostPath.startsWith('/media/')) {
    return '/host' + hostPath;
  }
  if (hostPath.startsWith('/mnt/')) {
    return '/host' + hostPath;
  }
  if (hostPath.startsWith('/run/media/')) {
    return '/host' + hostPath;
  }
  return hostPath;
}

// Convertir ruta del container a ruta del host (para mostrar en UI)
function containerPathToHostPath(containerPath: string): string {
  if (containerPath.startsWith('/host/')) {
    return containerPath.replace('/host', '');
  }
  return containerPath;
}

// Asegurar que existe el directorio de backups
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Archivo de configuración
const CONFIG_FILE = path.join(BACKUP_DIR, 'backup-config.json');

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

interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
  type: 'manual' | 'automatic';
  status: 'completed' | 'failed';
  path: string;
}

// Cargar configuración
function loadConfig(): BackupConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading backup config:', error);
  }
  return {
    enabled: false,
    frequency: 'daily',
    time: '03:00',
    maxBackups: 7,
    backupPath: BACKUP_DIR,
  };
}

// Guardar configuración
function saveConfig(config: BackupConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Listar backups
function listBackups(backupPath: string = BACKUP_DIR): BackupInfo[] {
  const backups: BackupInfo[] = [];
  const metadataFile = path.join(BACKUP_DIR, 'backups-metadata.json');
  
  try {
    // Cargar metadata si existe
    let metadata: Record<string, Partial<BackupInfo>> = {};
    if (fs.existsSync(metadataFile)) {
      metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
    }
    
    // Buscar archivos de backup - convertir ruta del host a container
    const containerBackupPath = hostPathToContainerPath(backupPath);
    const searchPaths = [BACKUP_DIR];
    if (containerBackupPath !== BACKUP_DIR && fs.existsSync(containerBackupPath)) {
      searchPaths.push(containerBackupPath);
    }
    
    for (const dir of searchPaths) {
      if (!fs.existsSync(dir)) continue;
      
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith('.sql') || file.endsWith('.backup') || file.endsWith('.dump')) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          const id = metadata[file]?.id || randomUUID();
          
          backups.push({
            id,
            filename: file,
            size: stats.size,
            createdAt: metadata[file]?.createdAt || stats.mtime.toISOString(),
            type: metadata[file]?.type || 'manual',
            status: 'completed',
            path: filePath,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error listing backups:', error);
  }
  
  // Ordenar por fecha descendente
  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Guardar metadata de backup
function saveBackupMetadata(backup: BackupInfo): void {
  const metadataFile = path.join(BACKUP_DIR, 'backups-metadata.json');
  let metadata: Record<string, Partial<BackupInfo>> = {};
  
  try {
    if (fs.existsSync(metadataFile)) {
      metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
    }
  } catch (error) {
    // Ignorar errores de lectura
  }
  
  metadata[backup.filename] = {
    id: backup.id,
    createdAt: backup.createdAt,
    type: backup.type,
  };
  
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
}

// Crear backup
async function createBackup(targetPath: string = BACKUP_DIR, type: 'manual' | 'automatic' = 'manual'): Promise<BackupInfo> {
  // Convertir ruta del host a ruta del container
  const containerPath = hostPathToContainerPath(targetPath);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `zora-backup-${timestamp}.sql`;
  const filePath = path.join(containerPath, filename);
  
  // Asegurar que existe el directorio
  if (!fs.existsSync(containerPath)) {
    fs.mkdirSync(containerPath, { recursive: true });
  }
  
  // Comando pg_dump
  const command = `PGPASSWORD="${DB_PASSWORD}" pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F p -f "${filePath}"`;
  
  try {
    await execAsync(command);
    
    const stats = fs.statSync(filePath);
    const backup: BackupInfo = {
      id: randomUUID(),
      filename,
      size: stats.size,
      createdAt: new Date().toISOString(),
      type,
      status: 'completed',
      path: filePath,
    };
    
    // Guardar metadata
    saveBackupMetadata(backup);
    
    // Actualizar última backup en config
    const config = loadConfig();
    config.lastBackup = backup.createdAt;
    saveConfig(config);
    
    // Limpiar backups antiguos
    cleanOldBackups(config.maxBackups);
    
    return backup;
  } catch (error: any) {
    console.error('Error creating backup:', error);
    throw new Error(`Error al crear backup: ${error.message}`);
  }
}

// Restaurar backup
async function restoreBackup(backupPath: string): Promise<void> {
  // Convertir ruta si es necesario
  const containerPath = hostPathToContainerPath(backupPath);
  
  if (!fs.existsSync(containerPath)) {
    throw new Error(`Archivo de backup no encontrado: ${containerPath}`);
  }
  
  // Comando psql para restaurar
  const command = `PGPASSWORD="${DB_PASSWORD}" psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f "${containerPath}"`;
  
  try {
    // Primero, limpiar la base de datos (drop all tables)
    // Usamos DB_USER en lugar de postgres hardcodeado
    const dropCommand = `PGPASSWORD="${DB_PASSWORD}" psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${DB_USER}; GRANT ALL ON SCHEMA public TO public;"`;
    await execAsync(dropCommand);
    
    // Restaurar
    await execAsync(command);
  } catch (error: any) {
    console.error('Error restoring backup:', error);
    throw new Error(`Error al restaurar backup: ${error.message}`);
  }
}

// Limpiar backups antiguos
function cleanOldBackups(maxBackups: number): void {
  const backups = listBackups();
  if (backups.length <= maxBackups) return;
  
  const toDelete = backups.slice(maxBackups);
  for (const backup of toDelete) {
    try {
      if (fs.existsSync(backup.path)) {
        fs.unlinkSync(backup.path);
      }
    } catch (error) {
      console.error(`Error deleting old backup ${backup.filename}:`, error);
    }
  }
}

// Calcular próximo backup
function calculateNextBackup(config: BackupConfig): string | null {
  if (!config.enabled) return null;
  
  const now = new Date();
  const [hours, minutes] = config.time.split(':').map(Number);
  let next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  
  switch (config.frequency) {
    case 'hourly':
      // Próxima hora completa
      next = new Date(now);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      break;
    case 'daily':
      // Si la hora ya pasó hoy, programar para mañana
      if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'weekly':
      const targetDay = config.dayOfWeek ?? 0;
      let daysUntil = targetDay - now.getDay();
      if (daysUntil < 0) {
        daysUntil += 7;
      } else if (daysUntil === 0 && next.getTime() <= now.getTime()) {
        daysUntil = 7;
      }
      next.setDate(next.getDate() + daysUntil);
      break;
    case 'monthly':
      const targetDayOfMonth = config.dayOfMonth || 1;
      next.setDate(targetDayOfMonth);
      if (next.getTime() <= now.getTime()) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
  }
  
  return next.toISOString();
}

// ============ SCHEDULER DE BACKUPS AUTOMÁTICOS ============
async function checkAndRunScheduledBackup(): Promise<void> {
  try {
    const config = loadConfig();
    
    // Si no está habilitado, no hacer nada
    if (!config.enabled) {
      return;
    }
    
    const now = new Date();
    const [targetHours, targetMinutes] = config.time.split(':').map(Number);
    
    // Verificar si es el momento de hacer backup
    let shouldBackup = false;
    
    switch (config.frequency) {
      case 'hourly':
        // Hacer backup al inicio de cada hora (minuto 0)
        if (now.getMinutes() === 0) {
          shouldBackup = true;
        }
        break;
        
      case 'daily':
        // Hacer backup a la hora configurada
        if (now.getHours() === targetHours && now.getMinutes() === targetMinutes) {
          shouldBackup = true;
        }
        break;
        
      case 'weekly':
        // Hacer backup el día de la semana configurado a la hora configurada
        const targetDay = config.dayOfWeek ?? 0;
        if (now.getDay() === targetDay && now.getHours() === targetHours && now.getMinutes() === targetMinutes) {
          shouldBackup = true;
        }
        break;
        
      case 'monthly':
        // Hacer backup el día del mes configurado a la hora configurada
        const targetDayOfMonth = config.dayOfMonth || 1;
        if (now.getDate() === targetDayOfMonth && now.getHours() === targetHours && now.getMinutes() === targetMinutes) {
          shouldBackup = true;
        }
        break;
    }
    
    // Verificar que no hayamos hecho backup en el último minuto (evitar duplicados)
    if (shouldBackup && config.lastBackup) {
      const lastBackupTime = new Date(config.lastBackup);
      const timeSinceLastBackup = now.getTime() - lastBackupTime.getTime();
      // Si el último backup fue hace menos de 2 minutos, no hacer otro
      if (timeSinceLastBackup < 2 * 60 * 1000) {
        shouldBackup = false;
      }
    }
    
    if (shouldBackup) {
      console.log(`[BACKUP SCHEDULER] Iniciando backup automático programado...`);
      const targetPath = config.backupPath || BACKUP_DIR;
      const backup = await createBackup(targetPath, 'automatic');
      console.log(`[BACKUP SCHEDULER] Backup automático completado: ${backup.filename}`);
      
      // Actualizar nextBackup
      const updatedConfig = loadConfig();
      updatedConfig.nextBackup = calculateNextBackup(updatedConfig) || undefined;
      saveConfig(updatedConfig);
    }
  } catch (error) {
    console.error('[BACKUP SCHEDULER] Error en backup automático:', error);
  }
}

// Iniciar el scheduler (revisa cada minuto)
function startBackupScheduler(): void {
  if (backupSchedulerInterval) {
    clearInterval(backupSchedulerInterval);
  }
  
  console.log('[BACKUP SCHEDULER] Scheduler iniciado - revisando cada minuto');
  
  // Revisar inmediatamente al iniciar
  checkAndRunScheduledBackup();
  
  // Revisar cada minuto
  backupSchedulerInterval = setInterval(() => {
    checkAndRunScheduledBackup();
  }, 60 * 1000); // 60 segundos
}

// Detener el scheduler
function stopBackupScheduler(): void {
  if (backupSchedulerInterval) {
    clearInterval(backupSchedulerInterval);
    backupSchedulerInterval = null;
    console.log('[BACKUP SCHEDULER] Scheduler detenido');
  }
}

export const backupRoutes: FastifyPluginAsync = async (app) => {
  // Iniciar el scheduler de backups automáticos
  startBackupScheduler();
  
  // Detener scheduler cuando se cierra la app
  app.addHook('onClose', async () => {
    stopBackupScheduler();
  });

  // Obtener información del sistema
  app.get('/backup/system-info', async (req, reply) => {
    try {
      // Obtener tamaño de la base de datos
      const dbSizeResult = await app.prisma.$queryRaw<[{ pg_size_pretty: string }]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as pg_size_pretty
      `;
      
      const totalProducts = await app.prisma.product.count();
      const totalSales = await app.prisma.sale.count();
      
      const config = loadConfig();
      const backups = listBackups();
      
      return {
        dbSize: dbSizeResult[0]?.pg_size_pretty || '0 MB',
        totalProducts,
        totalSales,
        totalCustomers: 0,
        lastBackup: config.lastBackup || null,
        backupCount: backups.length,
      };
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // Listar backups
  app.get('/backup/list', async (req, reply) => {
    try {
      const config = loadConfig();
      return listBackups(config.backupPath);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // Obtener configuración
  app.get('/backup/config', async (req, reply) => {
    try {
      const config = loadConfig();
      config.nextBackup = calculateNextBackup(config) || undefined;
      return config;
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // Guardar configuración
  app.post('/backup/config', async (req, reply) => {
    try {
      const body = req.body as BackupConfig;
      const currentConfig = loadConfig();
      const newConfig = { ...currentConfig, ...body };
      newConfig.nextBackup = calculateNextBackup(newConfig) || undefined;
      saveConfig(newConfig);
      return { success: true, config: newConfig };
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // Crear backup
  app.post('/backup/create', async (req, reply) => {
    try {
      const body = req.body as { path?: string } | undefined;
      const targetPath = body?.path || BACKUP_DIR;
      const backup = await createBackup(targetPath, 'manual');
      return { success: true, backup, message: 'Backup creado exitosamente' };
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  });

  // Restaurar backup por ID
  app.post('/backup/restore', async (req, reply) => {
    try {
      const { backupId, filename } = req.body as { backupId: string; filename: string };
      const backups = listBackups();
      const backup = backups.find(b => b.id === backupId || b.filename === filename);
      
      if (!backup) {
        return reply.status(404).send({ success: false, message: 'Backup no encontrado' });
      }
      
      await restoreBackup(backup.path);
      return { success: true, message: 'Sistema restaurado exitosamente' };
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  });

  // Subir y restaurar backup
  app.post('/backup/upload-and-restore', async (req, reply) => {
    try {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ success: false, message: 'No se recibió archivo' });
      }
      
      const filename = data.filename;
      if (!filename.endsWith('.sql') && !filename.endsWith('.backup') && !filename.endsWith('.dump')) {
        return reply.status(400).send({ success: false, message: 'Formato de archivo no válido' });
      }
      
      const uploadPath = path.join(BACKUP_DIR, `uploaded-${Date.now()}-${filename}`);
      
      // Guardar archivo
      await pipeline(data.file, fs.createWriteStream(uploadPath));
      
      // Restaurar
      await restoreBackup(uploadPath);
      
      // Guardar metadata
      const stats = fs.statSync(uploadPath);
      saveBackupMetadata({
        id: randomUUID(),
        filename: path.basename(uploadPath),
        size: stats.size,
        createdAt: new Date().toISOString(),
        type: 'manual',
        status: 'completed',
        path: uploadPath,
      });
      
      return { success: true, message: 'Backup subido y restaurado exitosamente' };
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  });

  // Descargar backup
  app.get('/backup/download/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const backups = listBackups();
      const backup = backups.find(b => b.id === id);
      
      if (!backup || !fs.existsSync(backup.path)) {
        return reply.status(404).send({ message: 'Backup no encontrado' });
      }
      
      const stream = fs.createReadStream(backup.path);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${backup.filename}"`);
      return reply.send(stream);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // Eliminar backup
  app.delete('/backup/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const backups = listBackups();
      const backup = backups.find(b => b.id === id);
      
      if (!backup) {
        return reply.status(404).send({ message: 'Backup no encontrado' });
      }
      
      if (fs.existsSync(backup.path)) {
        fs.unlinkSync(backup.path);
      }
      
      return { success: true, message: 'Backup eliminado' };
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });
};
