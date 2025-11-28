import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export async function authRoutes(app: FastifyInstance) {
  const loginSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(4)
  });

  const createUserSchema = z.object({
    username: z.string().min(3),
    name: z.string().optional(),
    password: z.string().min(4),
    role: z.enum(['admin', 'operario']).default('operario'),
    isActive: z.boolean().default(true)
  });

  const updateUserSchema = z.object({
    username: z.string().min(3).optional(),
    name: z.string().optional(),
    password: z.string().min(4).optional(),
    role: z.enum(['admin', 'operario']).optional(),
    isActive: z.boolean().optional()
  });

  // Login
  app.post('/auth/login', {
    schema: {
      summary: 'Login',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: { username: { type: 'string' }, password: { type: 'string' } },
      },
      response: { 200: { type: 'object', properties: { token: { type: 'string' }, user: { type: 'object' } } } },
    },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Credenciales inválidas' });
    }
    const { username, password } = parsed.data;

    const user = await app.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      return reply.code(401).send({ message: 'Usuario o contraseña incorrectos' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ message: 'Usuario o contraseña incorrectos' });
    }

    const token = await (reply as any).jwtSign({ sub: user.id, username: user.username, role: user.role });
    return reply.send({ 
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  });

  // Obtener usuario actual
  app.get('/auth/me', {
    schema: {
      summary: 'Obtener usuario actual',
      tags: ['auth'],
    },
  }, async (request, reply) => {
    try {
      await (request as any).jwtVerify();
      const payload = (request as any).user;
      const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        return reply.code(401).send({ message: 'Usuario no encontrado' });
      }
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      };
    } catch {
      return reply.code(401).send({ message: 'No autorizado' });
    }
  });

  // ============ CRUD DE USUARIOS ============

  // Listar usuarios
  app.get('/users', {
    schema: {
      summary: 'Listar usuarios',
      tags: ['users'],
    },
  }, async (request, reply) => {
    const users = await app.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return users;
  });

  // Obtener usuario por ID
  app.get('/users/:id', {
    schema: {
      summary: 'Obtener usuario',
      tags: ['users'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await app.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!user) {
      return reply.code(404).send({ message: 'Usuario no encontrado' });
    }
    return user;
  });

  // Crear usuario
  app.post('/users', {
    schema: {
      summary: 'Crear usuario',
      tags: ['users'],
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          name: { type: 'string' },
          password: { type: 'string' },
          role: { type: 'string' },
          isActive: { type: 'boolean' }
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    const { username, name, password, role, isActive } = parsed.data;

    // Verificar si el username ya existe
    const existing = await app.prisma.user.findUnique({ where: { username } });
    if (existing) {
      return reply.code(400).send({ message: 'El usuario ya existe' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await app.prisma.user.create({
      data: {
        username,
        name,
        passwordHash,
        role,
        isActive
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    return reply.code(201).send(user);
  });

  // Actualizar usuario
  app.patch('/users/:id', {
    schema: {
      summary: 'Actualizar usuario',
      tags: ['users'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object' },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    const { username, name, password, role, isActive } = parsed.data;

    // Verificar si el usuario existe
    const existing = await app.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ message: 'Usuario no encontrado' });
    }

    // Si cambia username, verificar que no exista
    if (username && username !== existing.username) {
      const usernameExists = await app.prisma.user.findUnique({ where: { username } });
      if (usernameExists) {
        return reply.code(400).send({ message: 'El usuario ya existe' });
      }
    }

    const updateData: any = {};
    if (username) updateData.username = username;
    if (name !== undefined) updateData.name = name;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    const user = await app.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return user;
  });

  // Eliminar usuario (desactivar)
  app.delete('/users/:id', {
    schema: {
      summary: 'Eliminar usuario',
      tags: ['users'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await app.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ message: 'Usuario no encontrado' });
    }

    // No permitir eliminar el último admin
    if (existing.role === 'admin') {
      const adminCount = await app.prisma.user.count({ where: { role: 'admin', isActive: true } });
      if (adminCount <= 1) {
        return reply.code(400).send({ message: 'No se puede eliminar el único administrador' });
      }
    }

    await app.prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    return { message: 'Usuario eliminado' };
  });
}


