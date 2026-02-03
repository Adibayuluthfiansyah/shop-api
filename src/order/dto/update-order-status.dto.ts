import { IsEnum } from 'class-validator';
import { OrderStatus } from 'generated/prisma/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, {
    message:
      'Status harus salah satu dari: PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED',
  })
  status: OrderStatus;
}
