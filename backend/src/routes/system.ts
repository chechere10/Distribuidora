import { FastifyPluginAsync } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MountPoint {
  path: string;
  device: string;
  type: string;
  size: string;
  available: string;
  label: string;
}

// Rutas base disponibles para el explorador
const BROWSE_ROOTS = [
  { hostPath: '/host/home', displayPath: '/home', label: 'Home' },
  { hostPath: '/host/media', displayPath: '/media', label: 'Media (USB/Discos)' },
  { hostPath: '/host/mnt', displayPath: '/mnt', label: 'Puntos de Montaje' },
  { hostPath: '/host/run/media', displayPath: '/run/media', label: 'Media Runtime' },
  { hostPath: '/app/backups', displayPath: '/app/backups', label: 'Backups del Sistema' },
];

// Convertir ruta de display a ruta real del contenedor
const toContainerPath = (displayPath: string): string => {
  if (displayPath === '/') return '/';
  for (const root of BROWSE_ROOTS) {
    if (displayPath.startsWith(root.displayPath)) {
      return displayPath.replace(root.displayPath, root.hostPath);
    }
  }
  return displayPath;
};

// Convertir ruta del contenedor a ruta de display
const toDisplayPath = (containerPath: string): string => {
  for (const root of BROWSE_ROOTS) {
    if (containerPath.startsWith(root.hostPath)) {
      return containerPath.replace(root.hostPath, root.displayPath);
    }
  }
  return containerPath;
};

export const systemRoutes: FastifyPluginAsync = async (app) => {
  // Obtener dispositivos/puntos de montaje disponibles
  app.get('/system/mount-points', async (req, reply) => {
    try {
      const mountPoints: MountPoint[] = [];
      
      // Ejecutar df para obtener puntos de montaje
      const { stdout } = await execAsync('df -h --output=target,source,fstype,size,avail 2>/dev/null || df -h');
      const lines = stdout.trim().split('\n').slice(1); // Saltar header
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const mountPath = parts[0];
          const device = parts[1];
          const fsType = parts[2];
          const size = parts[3];
          const available = parts[4];
          
          // Filtrar solo puntos de montaje relevantes para backups
          if (
            mountPath.startsWith('/media') ||
            mountPath.startsWith('/mnt') ||
            mountPath.startsWith('/run/media') ||
            mountPath === '/home' ||
            mountPath.startsWith('/home/')
          ) {
            // Obtener etiqueta del dispositivo si existe
            let label = path.basename(mountPath);
            try {
              const { stdout: labelOut } = await execAsync(`lsblk -o LABEL ${device} 2>/dev/null | tail -1`);
              if (labelOut.trim()) {
                label = labelOut.trim();
              }
            } catch {
              // Ignorar errores de lsblk
            }
            
            mountPoints.push({
              path: mountPath,
              device,
              type: fsType,
              size,
              available,
              label: label || path.basename(mountPath),
            });
          }
        }
      }
      
      // Agregar rutas comunes para backups
      const commonPaths = [
        { path: '/app/backups', label: 'Backups del Sistema' },
        { path: '/tmp', label: 'Temporal' },
      ];
      
      for (const common of commonPaths) {
        if (fs.existsSync(common.path)) {
          // Verificar si ya está en la lista
          if (!mountPoints.find(m => m.path === common.path)) {
            try {
              const stats = fs.statfsSync ? fs.statfsSync(common.path) : null;
              mountPoints.unshift({
                path: common.path,
                device: 'local',
                type: 'local',
                size: '-',
                available: '-',
                label: common.label,
              });
            } catch {
              mountPoints.unshift({
                path: common.path,
                device: 'local',
                type: 'local',
                size: '-',
                available: '-',
                label: common.label,
              });
            }
          }
        }
      }
      
      return mountPoints;
    } catch (error: any) {
      console.error('Error getting mount points:', error);
      // Retornar al menos las rutas por defecto
      return [
        { path: '/app/backups', device: 'local', type: 'local', size: '-', available: '-', label: 'Backups del Sistema' },
      ];
    }
  });

  // Listar contenido de un directorio
  app.get('/system/browse', async (req, reply) => {
    try {
      const { path: dirPath } = req.query as { path?: string };
      const displayPath = dirPath || '/';
      
      // Si es la raíz, mostrar los puntos de acceso disponibles
      if (displayPath === '/') {
        const items = [];
        for (const root of BROWSE_ROOTS) {
          if (fs.existsSync(root.hostPath)) {
            items.push({
              name: root.label,
              path: root.displayPath,
              isDirectory: true,
            });
          }
        }
        return {
          currentPath: '/',
          parentPath: '/',
          items,
        };
      }
      
      // Convertir a ruta del contenedor
      const containerPath = toContainerPath(displayPath);
      
      if (!fs.existsSync(containerPath)) {
        return reply.status(404).send({ message: 'Ruta no encontrada' });
      }
      
      const stats = fs.statSync(containerPath);
      if (!stats.isDirectory()) {
        return reply.status(400).send({ message: 'La ruta no es un directorio' });
      }
      
      const items = fs.readdirSync(containerPath, { withFileTypes: true });
      const directories = items
        .filter(item => {
          try {
            return item.isDirectory() && !item.name.startsWith('.');
          } catch {
            return false;
          }
        })
        .map(item => ({
          name: item.name,
          path: path.join(displayPath, item.name),
          isDirectory: true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // Calcular parent path
      const parentDisplay = path.dirname(displayPath);
      
      return {
        currentPath: displayPath,
        parentPath: parentDisplay === '.' ? '/' : parentDisplay,
        items: directories,
      };
    } catch (error: any) {
      console.error('Browse error:', error);
      return reply.status(500).send({ message: error.message });
    }
  });

  // Verificar si una ruta es escribible
  app.post('/system/check-path', async (req, reply) => {
    try {
      const { path: checkPath } = req.body as { path: string };
      
      if (!checkPath) {
        return { valid: false, message: 'Ruta no especificada' };
      }
      
      // Convertir a ruta del contenedor
      const containerPath = toContainerPath(checkPath);
      
      // Verificar si existe
      if (!fs.existsSync(containerPath)) {
        // Intentar crear
        try {
          fs.mkdirSync(containerPath, { recursive: true });
          return { valid: true, message: 'Directorio creado', created: true };
        } catch (e: any) {
          return { valid: false, message: `No se puede crear: ${e.message}` };
        }
      }
      
      // Verificar si es directorio
      const stats = fs.statSync(containerPath);
      if (!stats.isDirectory()) {
        return { valid: false, message: 'La ruta no es un directorio' };
      }
      
      // Verificar permisos de escritura
      try {
        const testFile = path.join(containerPath, `.write-test-${Date.now()}`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        return { valid: true, message: 'Ruta válida y con permisos de escritura' };
      } catch (e: any) {
        return { valid: false, message: 'Sin permisos de escritura en esta ruta' };
      }
    } catch (error: any) {
      return { valid: false, message: error.message };
    }
  });
};
