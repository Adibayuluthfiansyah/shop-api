import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters long' })
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
