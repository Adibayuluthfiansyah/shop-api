import { IsString, IsNumber, IsOptional, Min, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'iPhone 15 Pro Max',
    minLength: 1,
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Latest iPhone with A17 Pro chip, 256GB storage, Titanium design',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Product price in IDR',
    example: 21999000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Price must be a non-negative' })
  price: number;

  @ApiProperty({
    description: 'Available stock quantity',
    example: 50,
    minimum: 0,
  })
  @IsInt()
  @Min(0, { message: 'Stock must be a non-negative' })
  stock: number;

  @ApiProperty({
    description: 'Category ID for the product',
    example: 1,
  })
  @IsInt()
  categoryId: number;

  @ApiPropertyOptional({
    description: 'Product image URL',
    example: 'https://example.com/images/iphone-15-pro.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
