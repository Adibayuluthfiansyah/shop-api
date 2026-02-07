import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from 'generated/prisma/enums';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Order status to update',
    enum: OrderStatus,
    example: 'PROCESSING',
    enumName: 'OrderStatus',
  })
  @IsEnum(OrderStatus, {
    message:
      'Status harus salah satu dari: PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED',
  })
  status: OrderStatus;
}
