import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

export class CreateCategoryDto {
  @Transform(({ value }: { value: string }) =>
    sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    }),
  )
  @ApiProperty({
    description: 'Category name',
    example: 'Electronics',
    minLength: 1,
  })
  @IsString()
  name: string;
}
