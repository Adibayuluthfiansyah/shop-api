import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import * as bcrypt from 'bcrypt';
import { UserProfileType } from './types/user-profile.type';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // cek register user
  async register(dto: RegisterDto) {
    const exitingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (exitingUser) {
      throw new ConflictException('Email already exists');
    }

    // hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    //save user to db
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        phone: dto.phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
    return {
      message: 'User registered successfully',
      user,
    };
  }

  async login(dto: LoginDto) {
    //find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    // Check if user has password (not OAuth user)
    if (!user.password) {
      throw new UnauthorizedException(
        'This account uses Google login. Please sign in with Google.',
      );
    }

    // cek password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    // generate jwt token
    const tokens = await this.getTokens(user.id, user.email, user.role);

    // Simpan hash refresh token ke database
    await this.updateRefreshToken(user.id, tokens.refresh_token);

    return {
      message: 'Login successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  // google login
  async googleLogin(dto: GoogleLoginDto) {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: dto.googleId }, { email: dto.email }],
      },
    });

    if (user) {
      if (user.password && user.password !== 'GOOGLE_AUTH_NO_PASSWORD') {
        throw new ConflictException(
          'This email is already registered. Please login with email and password instead, or use a different Google account.',
        );
      }

      if (user.googleId && user.googleId !== dto.googleId) {
        throw new ForbiddenException(
          'This email is already linked to a different Google account.',
        );
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: dto.googleId,
          name: dto.name,
          image: dto.image,
          emailVerified:
            (dto.emailVerified as unknown) === true
              ? new Date()
              : dto.emailVerified,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          googleId: dto.googleId,
          image: dto.image,
          emailVerified:
            (dto.emailVerified as unknown) === true
              ? new Date()
              : dto.emailVerified,
          password: 'GOOGLE_AUTH_NO_PASSWORD',
          role: 'USER',
        },
      });
    }

    // Generate JWT token
    const tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refresh_token);

    return {
      message: 'Google login successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      },
      ...tokens,
    };
  }
  //get user profile
  async getProfile(userId: string): Promise<UserProfileType> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new ConflictException('User not found');
    }
    return user as UserProfileType;
  }

  // logout
  async logout(userId: string) {
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        hashedRefreshToken: { not: null },
      },
      data: {
        hashedRefreshToken: null,
      },
    });
    return true;
  }

  async refreshTokens(userId: string, rt: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Perbaikan logic: cek user & hashedRefreshToken
    if (!user || !user.hashedRefreshToken)
      throw new ForbiddenException('Access Denied');

    const rtMatches = await bcrypt.compare(rt, user.hashedRefreshToken);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    const tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refresh_token);

    return tokens;
  }

  // update refresh token
  async updateRefreshToken(userId: string, rt: string) {
    const hash = await bcrypt.hash(rt, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        hashedRefreshToken: hash,
      },
    });
  }

  // get token
  async getTokens(userId: string, email: string, role: string) {
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      ),
    ]);
    return {
      access_token: at,
      refresh_token: rt,
    };
  }
}
