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
  HttpCode,
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
import type { MidtransNotification } from './types/midtrans.type';

@Controller('order')
// ❌ HAPUS UseGuards DARI SINI (Biar Webhook aman)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // 1. CREATE ORDER
  @Post()
  @UseGuards(JwtAuthGuard) // ✅ Pasang Disini
  @ApiResponse({
    status: 201,
    type: OrderResponseDto,
    description: 'Order created successfully',
  })
  createOrder(@CurrentUser() user: CurrentUserType) {
    return this.orderService.createOrder(user.userId);
  }

  // 2. GET ALL ORDERS (Admin)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard) // ✅ Pasang Disini (Urutan: Jwt dulu baru Roles)
  @Roles(Role.ADMIN)
  @ApiResponse({
    status: 200,
    type: [OrderResponseDto],
    description: 'List of all orders',
  })
  getAllOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.getAllOrders(status, page, limit);
  }

  // 3. GET MY ORDERS (User)
  @Get('my-orders')
  @UseGuards(JwtAuthGuard) // ✅ Pasang Disini
  getMyOrders(
    @CurrentUser() user: CurrentUserType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.orderService.getMyOrders(user.userId, page, limit);
  }

  // 4. GET SELLER ORDERS (Seller)
  // ⚠️ PINDAHKAN KE ATAS ':id' AGAR TIDAK ERROR 400/404
  @Get('seller/orders')
  @UseGuards(JwtAuthGuard, RolesGuard) // ✅ Pasang Disini
  @Roles(Role.SELLER)
  @ApiResponse({ status: 200, description: 'Get orders for seller items' })
  getSellerOrders(
    @CurrentUser() user: CurrentUserType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.getSellerOrders(user.userId, page, limit, status);
  }

  // 5. WEBHOOK MIDTRANS (PUBLIC)
  @Post('notification')
  @HttpCode(200)
  // ❌ JANGAN PAKAI GUARD DISINI
  async midtransNotification(@Body() payload: MidtransNotification) {
    console.log(
      '🔔 Webhook notification received at:',
      new Date().toISOString(),
    );
    try {
      const result = await this.orderService.handleNotification(payload);
      console.log('✅ Webhook processed successfully');
      return result;
    } catch (error) {
      console.error('❌ Webhook processing failed:', error);
      throw error;
    }
  }

  // 5b. TEST ENDPOINT - Manual check order status (for debugging)
  @Get('debug/:id')
  async debugOrderStatus(@Param('id', ParseIntPipe) id: number) {
    const order = await this.orderService['prisma'].order.findUnique({
      where: { id },
      include: { items: true },
    });
    return {
      message: 'Debug info for order',
      order,
      timestamp: new Date().toISOString(),
    };
  }

  // 6. GET ORDER DETAIL
  // (Ditaruh agak bawah karena menangkap parameter :id)
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOrderDetail(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    console.log('📋 GET Order Detail Request:', {
      userId: user.userId,
      orderId: id,
      userRole: user.role,
    });

    const isAdmin = user.role === Role.ADMIN;
    try {
      const order = await this.orderService.getOrderDetails(
        user.userId,
        id,
        isAdmin,
      );
      console.log('✅ Order detail retrieved successfully');
      return order;
    } catch (error) {
      console.error('❌ Get order detail failed:', error.message);
      throw error;
    }
  }

  //  UPDATE STATUS (Admin)
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(id, dto);
  }

  //  CANCEL ORDER (User)
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  cancelOrder(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.cancelOrder(user.userId, id);
  }
}
