import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthenticateAdminUseCase } from '../../application/use-cases/authenticate-admin.use-case.js';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export function registerAuthRoutes(
  app: FastifyInstance,
  authenticateAdminUseCase: AuthenticateAdminUseCase
) {
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.format(),
      });
    }

    try {
      const user = await authenticateAdminUseCase.execute(parseResult.data);
      const token = app.jwt.sign({
        id: user.id,
        username: user.username,
      });

      return reply.send({
        token,
        user,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 401).send({
        error: err.message || 'Authentication failed',
      });
    }
  });

  app.get(
    '/api/auth/me',
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ user: request.user });
    }
  );
}
