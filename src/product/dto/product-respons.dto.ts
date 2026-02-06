import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from 'src/category/dto/category-respons.dto';

class SellerInfo {
  @ApiProperty({ example: 1 })
  id: number;
  @ApiProperty({ example: 'Juragan Baju' })
  name: string;
}
export class ProductResponsDto {
  @ApiProperty({ example: 5 })
  id: number;
  @ApiProperty({ example: 'Kaos Polos' })
  description: string;
  @ApiProperty({ example: 2000000 })
  price: number;
  @ApiProperty({ example: 10 })
  stock: number;
  @ApiProperty({ example: 'https://via.placeholder.com/150', nullable: true })
  imageUrl?: string;
  @ApiProperty({ example: 1 })
  categoryId: number;

  @ApiProperty({ example: 1 })
  sellerId: number;

  @ApiProperty({ type: CategoryResponseDto })
  category: CategoryResponseDto;

  @ApiProperty({ type: SellerInfo })
  seller: SellerInfo;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
