import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

type JwtPayload = {
  sub: number;
  email: string;
  role: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }
  async validate(payload: JwtPayload) {
    console.log('🔐 JWT Validate - Payload:', payload);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      console.error('❌ JWT Validate - User not found for id:', payload.sub);
      throw new UnauthorizedException('User not found');
    }

    console.log('✅ JWT Validate - User authenticated:', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
