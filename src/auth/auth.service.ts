import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
      throw new ConflictException('Email or password is incorrect');
    }
    // cek password
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password as string,
    );
    if (!isPasswordValid) {
      throw new ConflictException('Email or password is incorrect');
    }
    // generate jwt token
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accesToken = this.jwtService.sign(payload);
    return {
      message: 'Login successfully',
      accesToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
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
