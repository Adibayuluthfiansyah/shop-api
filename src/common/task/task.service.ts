import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);
  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanUpIdempotencyKeys() {
    this.logger.log(`Cleaning up idempotency keys...`);
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await this.prisma.idempotencyKey.deleteMany({
        where: {
          createdAt: {
            lt: twentyFourHoursAgo,
          },
        },
      });
      this.logger.log(`Cleaned up ${result.count} idempotency keys.`);
    } catch (error: any) {
      this.logger.error(
        `Failed to clean up idempotency keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error.stack,
      );
    }
  }
}
