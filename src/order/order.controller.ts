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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OrderResponseDto } from './dto/order-response.dto';
import type { MidtransNotification } from './types/midtrans.type';

@ApiTags('Orders')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new order',
    description:
      'Create order from current user cart items. Cart will be cleared after order is created. Returns Midtrans payment token.',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully with payment token',
    type: OrderResponseDto,
    schema: {
      example: {
        message: 'Order created successfully',
        orderId: 1,
        snapToken: '91a5c283-aff8-4cee-b2c5-ec9ff5a00f27',
        redirectUrl: 'https://app.sandbox.midtrans.com/snap/v4/redirection/...',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Cart is empty or items out of stock',
    schema: {
      example: {
        statusCode: 400,
        message: 'Cart is empty',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  createOrder(@CurrentUser() user: CurrentUserType) {
    return this.orderService.createOrder(user.userId);
  }

  @Get('my-orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my orders',
    description:
      'Retrieve list of orders for the authenticated user with pagination',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'List of user orders',
    schema: {
      example: {
        data: [
          {
            id: 3,
            userId: 1,
            totalPrice: '6000000',
            status: 'PAID',
            createdAt: '2026-02-07T17:44:29.577Z',
            updatedAt: '2026-02-07T17:44:53.167Z',
            items: [
              {
                id: 3,
                orderId: 3,
                productId: 1,
                quantity: 5,
                price: '1200000',
                product: {
                  id: 1,
                  name: 'Vans Authentcic',
                  description: '100% Original',
                  price: '1200000',
                  category: {
                    id: 1,
                    name: 'Fashion',
                  },
                },
              },
            ],
          },
        ],
        meta: {
          total: 5,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  getMyOrders(
    @CurrentUser() user: CurrentUserType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.orderService.getMyOrders(user.userId, page, limit);
  }

  @Get('seller/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get seller orders',
    description: 'Retrieve orders containing products owned by the seller',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filter by order status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of orders for seller products',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires SELLER role',
  })
  getSellerOrders(
    @CurrentUser() user: CurrentUserType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.getSellerOrders(user.userId, page, limit, status);
  }

  @Post('notification')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Midtrans payment notification webhook',
    description:
      'Webhook endpoint for Midtrans payment notifications. This endpoint is PUBLIC and should not require authentication.',
  })
  @ApiBody({
    description: 'Midtrans notification payload',
    schema: {
      example: {
        transaction_time: '2026-02-07 17:44:53',
        transaction_status: 'settlement',
        transaction_id: '9a5e46b5-82c5-43e8-9c6e-4c391dcdcaf1',
        status_message: 'Success',
        status_code: '200',
        signature_key: 'abc123...',
        payment_type: 'bank_transfer',
        order_id: 'order-3-1770486269591',
        merchant_id: 'G141532850',
        gross_amount: '6000000.00',
        fraud_status: 'accept',
        currency: 'IDR',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Notification processed successfully',
    schema: {
      example: {
        status: 'ok',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature or order ID',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async midtransNotification(@Body() payload: MidtransNotification) {
    return this.orderService.handleNotification(payload);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get order details',
    description:
      'Retrieve detailed information about a specific order. Users can only access their own orders, admins can access all orders.',
  })
  @ApiParam({ name: 'id', description: 'Order ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Order details',
    schema: {
      example: {
        id: 3,
        userId: 1,
        totalPrice: '6000000',
        status: 'PAID',
        createdAt: '2026-02-07T17:44:29.577Z',
        updatedAt: '2026-02-07T17:44:53.167Z',
        snapToken: '91a5c283-aff8-4cee-b2c5-ec9ff5a00f27',
        snapTokenRedirectUrl:
          'https://app.sandbox.midtrans.com/snap/v4/redirection/...',
        midtransOrderId: 'order-3-1770486269591',
        paymentType: 'bank_transfer',
        user: {
          id: 1,
          email: 'user@user.com',
          name: 'user',
          phone: '0889165658',
        },
        items: [
          {
            id: 3,
            orderId: 3,
            productId: 1,
            quantity: 5,
            price: '1200000',
            product: {
              id: 1,
              name: 'Vans Authentcic',
              description: '100% Original',
              price: '1200000',
              stock: 45,
              imageUrl: 'https://example.com/image.jpg',
              category: {
                id: 1,
                name: 'Fashion',
              },
            },
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not allowed to access this order',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  getOrderDetail(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const isAdmin = user.role === Role.ADMIN;
    return this.orderService.getOrderDetails(user.userId, id, isAdmin);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update order status',
    description:
      'Update order status (Admin only). If status is changed to CANCELED, product stock will be returned.',
  })
  @ApiParam({ name: 'id', description: 'Order ID', type: Number })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
    schema: {
      example: {
        message: 'Order status updated successfully',
        order: {
          id: 1,
          userId: 1,
          totalPrice: '100000',
          status: 'SHIPPED',
          items: [],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires ADMIN role',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel order',
    description:
      'Cancel an order (only orders with PENDING status can be canceled). Product stock will be returned.',
  })
  @ApiParam({ name: 'id', description: 'Order ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Order successfully canceled',
    schema: {
      example: {
        message: 'Order successfully canceled. Stock returned.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Order cannot be canceled',
    schema: {
      example: {
        statusCode: 400,
        message: 'Order cannot be canceled. Current status: PAID',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  cancelOrder(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.cancelOrder(user.userId, id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all orders',
    description:
      'Retrieve list of all orders in the system with pagination and optional status filter (Admin only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filter by order status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all orders',
    type: [OrderResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires ADMIN role',
  })
  getAllOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.getAllOrders(status, page, limit);
  }
}
