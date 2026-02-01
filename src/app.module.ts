import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ← Penting! Agar ConfigService bisa dipakai di semua module
    }),
    PrismaModule,
    AuthModule,
  ],
})
export class AppModule {}
