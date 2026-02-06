import { ApiProperty } from '@nestjs/swagger';

class ProductInCart {
  @ApiProperty({ example: 5 })
  id: number;

  @ApiProperty({ example: 'Macbook Pro M3' })
  name: string;

  @ApiProperty({ example: 20000000 })
  price: number;

  @ApiProperty({ example: 'https://via.placeholder.com/150' })
  imageUrl: string;
}

export class CartItemResponseDto {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ type: ProductInCart })
  product: ProductInCart;
}

export class CartResponseDto {
  @ApiProperty({ type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty({ example: 40000000, description: 'Total harga semua item' })
  totalPrice: number;
}
