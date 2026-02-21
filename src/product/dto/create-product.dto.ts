import { IsString, IsNumber, IsOptional, Min, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

export class CreateProductDto {
  @Transform(({ value }: { value: string }) =>
    sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    }),
  )
  @ApiProperty({
    description: 'Product name',
    example: 'iPhone 15 Pro Max',
    minLength: 1,
  })
  @IsString()
  name: string;

  @Transform(({ value }: { value?: string }) =>
    value
      ? sanitizeHtml(value, {
          allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
          allowedAttributes: {},
        })
      : value,
  )
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
  @Transform(({ value }) => {
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Price must be a non-negative' })
  price: number;

  @ApiProperty({
    description: 'Available stock quantity',
    example: 50,
    minimum: 0,
  })
  @Transform(({ value }) => {
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Stock must be a non-negative' })
  stock: number;

  @ApiProperty({
    description: 'Category ID for the product',
    example: 1,
  })
  @Transform(({ value }) => {
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @Type(() => Number)
  @IsInt()
  categoryId: number;

  @Transform(({ value }: { value?: string }) =>
    value
      ? sanitizeHtml(value, {
          allowedTags: [],
          allowedAttributes: {},
        })
      : value,
  )
  @ApiPropertyOptional({
    description: 'Product image URL',
    example: 'https://example.com/images/iphone-15-pro.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
