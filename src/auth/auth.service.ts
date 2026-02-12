import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import * as bcrypt from 'bcrypt';
import { UserProfileType } from './types/user-profile.type';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    return {
      message: 'Login successfully',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // google login
  async googleLogin(dto: GoogleLoginDto) {
    // Check if user exists by googleId or email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: dto.googleId }, { email: dto.email }],
      },
    });

    if (user) {
      // User exists - update their info from Google
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: dto.googleId,
          name: dto.name,
          image: dto.image,
          emailVerified: dto.emailVerified || new Date(),
        },
      });
    } else {
      // New user - create account
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          googleId: dto.googleId,
          image: dto.image,
          emailVerified: dto.emailVerified || new Date(),
          password: null,
        },
      });
    }

    // Generate JWT token
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Google login successfully',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      },
    };
  }

  //get user profile
  async getProfile(userId: number): Promise<UserProfileType> {
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
}
