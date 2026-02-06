import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrderStatus, Role } from '@prisma/client';
import { OrderService } from './order.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { ApiResponse } from '@nestjs/swagger';
import { OrderResponseDto } from './dto/order-response.dto';

@Controller('order')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}
  //create order
  @Post()
  @ApiResponse({
    status: 201,
    type: OrderResponseDto,
    description: 'Order created successfully',
  })
  createOrder(@CurrentUser() user: CurrentUserType) {
    return this.orderService.createOrder(user.userId);
  }
  // get all orders (admin only)
  @Get()
  @ApiResponse({
    status: 200,
    type: [OrderResponseDto],
    description: 'List of all orders',
  })
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getAllOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.getAllOrders(status, page, limit);
  }
  // get my orders
  @Get('my-orders')
  getMyOrders(
    @CurrentUser() user: CurrentUserType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.orderService.getMyOrders(user.userId, page, limit);
  }

  // get order detail
  @Get(':id')
  getOrderDetail(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const isAdmin = user.role === Role.ADMIN;
    return this.orderService.getOrderDetails(user.userId, id, isAdmin);
  }
  // update order status (admin only)
  @Patch(':id/status')
  @Roles(Role.ADMIN)
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(id, dto);
  }
  // cancel order (user only)
  @Delete(':id')
  cancelOrder(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.cancelOrder(user.userId, id);
  }
}
