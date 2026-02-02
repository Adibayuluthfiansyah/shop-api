import { IsString, IsNumber, IsOptional, Min, IsInt } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0, { message: 'Price must be a non-negative' })
  price: number;

  @IsInt()
  @Min(0, { message: 'Stock must be a non-negative' })
  stock: number;

  @IsInt()
  categoryId: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
