import { IsInt, Min } from 'class-validator';

export class UpdateCartDto {
  @IsInt()
  @Min(1, { message: 'Quantity minimal 1' })
  quantity: number;
}
