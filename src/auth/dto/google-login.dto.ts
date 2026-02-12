import { IsEmail, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Email from Google account',
    example: 'user@gmail.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Full name from Google profile',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Google account ID (sub from JWT)',
    example: '1234567890',
  })
  @IsString()
  @IsNotEmpty()
  googleId: string;

  @ApiPropertyOptional({
    description: 'Profile image URL from Google',
    example: 'https://lh3.googleusercontent.com/a/...',
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({
    description: 'Email verification timestamp from Google',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  emailVerified?: Date;
}
