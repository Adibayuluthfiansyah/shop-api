import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method;
    const path = request.path;
    const user = request.user;
    const idempotencyKey = request.headers['idempotency-key'];

    // skip if no idempotency key
    if (!idempotencyKey) {
      return next.handle();
    }

    // skip if no authenticated user
    if (!user || !user.userId) {
      return next.handle();
    }

    // check for existing idempotency key
    const existingKey = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    // return cached response if available
    if (existingKey) {
      if (existingKey.userId !== user.userId) {
        this.logger.warn(
          `User ${user.userId} attempted to use Idempotency Key of another user.`,
        );
        throw new BadRequestException('Invalid Idempotency Key');
      }

      if (existingKey.method !== method || existingKey.path !== path) {
        throw new BadRequestException(
          'Idempotency key is already used for a different request',
        );
      }

      this.logger.log(
        `Idempotency Hit: ${idempotencyKey} for User ${user.userId}`,
      );

      const cachedResponse = JSON.parse(existingKey.response);
      response.status(existingKey.statusCode);
      if (
        typeof cachedResponse === 'object' &&
        !Array.isArray(cachedResponse) &&
        cachedResponse !== null
      ) {
        return of({
          ...cachedResponse,
          _cached: true,
          _cachedAt: existingKey.createdAt,
        });
      }
      return of(cachedResponse);
    }

    // save new response
    return next.handle().pipe(
      tap((data) => {
        const statusCode = response.statusCode || 200;
        void (async () => {
          try {
            await this.prisma.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                userId: user.userId,
                method,
                path,
                response: JSON.stringify(data),
                statusCode,
              },
            });

            this.logger.log(
              `Idempotency Key Saved: ${idempotencyKey} for User ${user.userId}`,
            );
          } catch (error: any) {
            if (error.code === 'P2002') {
              this.logger.warn(
                `Idempotency key ${idempotencyKey} already saved by a concurrent request.`,
              );
            } else {
              this.logger.error(
                `Failed to save idempotency key: ${error.message}`,
              );
            }
          }
        })();
      }),
    );
  }
}
