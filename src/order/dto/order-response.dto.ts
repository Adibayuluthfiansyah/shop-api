import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

class OrderItemResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 20000000 })
  price: number;

  @ApiProperty({ example: 'Macbook Pro M3' })
  productName: string;
}

export class OrderResponseDto {
  @ApiProperty({ example: 205 })
  id: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 40000000 })
  totalPrice: number;

  @ApiProperty({ enum: OrderStatus, example: 'PENDING' })
  status: OrderStatus;

  @ApiProperty({ type: [OrderItemResponse] })
  items: OrderItemResponse[];

  @ApiProperty()
  createdAt: Date;
}
