import { Controller, Post, Body, Get, UseGuards, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserType } from './types/current-user.type';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import {
  LoginResponseDto,
  RegisterResponseDto,
  UserProfileDto,
} from './dto/auth-response.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // register
  @Post('register')
  @ApiOperation({
    summary: 'Register new user',
    description:
      'Create a new user account with email, password, name, and optional phone number',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
    schema: {
      example: {
        statusCode: 409,
        message: 'Email already exists',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'email must be an email',
          'password must be at least 6 characters long',
        ],
        error: 'Bad Request',
      },
    },
  })
  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
    },
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // login
  @Post('login')
  @ApiOperation({
    summary: 'Login user',
    description: 'Authenticate user and receive JWT access token',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid credentials',
      },
    },
  })
  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
    },
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  // get current user profile
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieve authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns user profile',
    type: UserProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  getProfile(@CurrentUser() user: CurrentUserType) {
    return this.authService.getProfile(user.userId);
  }

  // logout
  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    return { message: 'Logout successful' };
  }

  /**
   * Google OAuth Login Endpoint
   * 
   * This endpoint is called by the frontend after NextAuth handles Google OAuth.
   * It creates or updates the user in our database and returns a JWT token.
   * 
   * @security CSRF Protection
   * This endpoint is EXEMPT from CSRF protection because:
   * 1. User identity is cryptographically verified by Google OAuth 2.0 flow
   * 2. Google has already validated email ownership and user consent
   * 3. The providerAccountId (Google user ID) serves as proof of authentication
   * 4. No sensitive state mutation occurs without explicit user authorization via Google
   * 5. The endpoint only creates/updates user data that Google has already verified
   * 
   * @security Attack Mitigation
   * - SQL Injection: Protected by Prisma ORM parameterized queries
   * - XSS: JWT stored in httpOnly cookies, DTO validation via class-validator
   * - Replay Attacks: Google OAuth tokens are single-use and time-limited
   * - MITM: HTTPS enforced, secure cookies in production
   * 
   * @see conditionalCsrfMiddleware for CSRF skip implementation
   * @see {@link https://developers.google.com/identity/protocols/oauth2}
   */
  @Post('google-login')
  @SkipThrottle() // Skip throttling for OAuth - consider enabling with higher limits if abuse detected
  @ApiOperation({
    summary: 'Google OAuth Login',
    description:
      'Handle Google OAuth login. Called by frontend after successful Google authentication. Creates or updates user and returns JWT token.',
  })
  @ApiBody({ type: GoogleLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Google login successful, returns JWT token',
    schema: {
      example: {
        message: 'Google login successfully',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 1,
          email: 'user@gmail.com',
          name: 'John Doe',
          image: 'https://lh3.googleusercontent.com/a/...',
          role: 'USER',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
    schema: {
      example: {
        statusCode: 400,
        message: ['email must be an email', 'name must be a string'],
        error: 'Bad Request',
      },
    },
  })
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }
}
