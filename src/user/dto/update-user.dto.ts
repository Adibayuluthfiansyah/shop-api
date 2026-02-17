import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsNotEmpty()
  @IsEnum(Role, { message: 'Role must be ADMIN, USER, or SELLER' })
  role: Role;
}
