import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserProfileDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'adibayu@gmail.com' })
  email: string;

  @ApiProperty({ example: 'Adibayu Luthfiansyah' })
  name: string;

  @ApiProperty({ example: '08123456789', required: false, nullable: true })
  phone?: string;

  @ApiProperty({ enum: Role, example: 'USER' })
  role: Role;

  @ApiProperty()
  createdAt: Date;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'Login successfully' })
  message: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accesToken: string;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 'User registered successfully' })
  message: string;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}
