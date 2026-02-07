import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as midtransClient from 'midtrans-client';
import * as crypto from 'crypto';
import {
  MidtransNotification,
  MidtransSnapResponse,
} from './types/midtrans.type';

type MidtransCoreApiFix = midtransClient.CoreApi & {
  transaction: {
    notification: (
      notificationJson: MidtransNotification,
    ) => Promise<MidtransNotification>;
  };
};
@Injectable()
export class OrderService {
  private snap: midtransClient.Snap;
  private apiClient: MidtransCoreApiFix;
  constructor(private prisma: PrismaService) {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY!,
      clientKey: process.env.MIDTRANS_CLIENT_KEY!,
    });
    this.apiClient = new midtransClient.CoreApi({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY!,
      clientKey: process.env.MIDTRANS_CLIENT_KEY!,
    }) as MidtransCoreApiFix;
  }

  // create order
  async createOrder(userId: number) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    if (cartItems.length > 20) {
      throw new BadRequestException('Too many items in cart (Max 20)');
    }

    // Sort by productId
    cartItems.sort((a, b) => a.productId - b.productId);

    // Calculate total price
    const totalPrice = cartItems.reduce((sum, item) => {
      return sum + item.quantity * Number(item.product.price);
    }, 0);

    // transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // stock check + decrement
      for (const item of cartItems) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count === 0) {
          throw new BadRequestException(
            `Product '${item.product.name}' is out of stock`,
          );
        }
      }

      // create order
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalPrice,
          status: OrderStatus.PENDING,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // clear cart
      await tx.cartItem.deleteMany({ where: { userId } });

      return newOrder;
    });

    // midtrans logic
    const midtransOrderId = `order-${order.id}-${Date.now()}`;
    const payload = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: Number(order.totalPrice),
      },
      customer_details: {
        first_name: `User${userId}`,
      },
    };
    try {
      // request token
      const transaction: MidtransSnapResponse =
        await this.snap.createTransaction(payload);
      // update order with snap token
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          snapToken: transaction.token,
          midtransOrderId: midtransOrderId,
          snapTokenRedirectUrl: transaction.redirect_url,
        },
      });
      return {
        message: 'Order created successfully',
        orderId: order.id,
        snapToken: transaction.token,
        redirectUrl: transaction.redirect_url,
      };
    } catch (error) {
      console.error('Midtrans Error:', error);
      throw new BadRequestException(
        'Order created but failed to generate payment token',
      );
    }
  }

  // handle midtrans notification
  async handleNotification(notificationJson: MidtransNotification) {
    console.log('📦 ===== MIDTRANS NOTIFICATION START =====');
    console.log(
      '📦 Received notification:',
      JSON.stringify(notificationJson, null, 2),
    );

    // verify signature
    const verifySignature = crypto
      .createHash('sha512')
      .update(
        notificationJson.order_id +
          notificationJson.status_code +
          notificationJson.gross_amount +
          process.env.MIDTRANS_SERVER_KEY,
      )
      .digest('hex');

    console.log('🔐 Signature validation:', {
      received: notificationJson.signature_key,
      calculated: verifySignature,
      isValid: verifySignature === notificationJson.signature_key,
    });

    if (verifySignature !== notificationJson.signature_key) {
      console.error('❌ Invalid Signature Key!');
      throw new BadRequestException('Invalid Signature Key');
    }

    console.log('✅ Signature valid');
    console.log('✅ Signature valid');
    // double check status with midtrans
    console.log('🔄 Checking transaction status with Midtrans API...');

    const statusResponse =
      await this.apiClient.transaction.notification(notificationJson);

    console.log(
      '📊 Midtrans status response:',
      JSON.stringify(statusResponse, null, 2),
    );

    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;
    const paymentType = statusResponse.payment_type;

    console.log('📋 Transaction details:', {
      orderId,
      transactionStatus,
      fraudStatus,
      paymentType,
    });

    // get real order ID
    console.log('🔍 Parsing order ID:', orderId);
    const realOrderId = Number(orderId.split('-')[1]);

    console.log('🆔 Real order ID:', realOrderId);

    if (isNaN(realOrderId)) {
      console.error('❌ Invalid order ID format!');
      throw new BadRequestException('Invalid order ID in notification');
    }

    //check order existence at our database
    console.log('🔍 Searching order in database with ID:', realOrderId);

    const currentOrder = await this.prisma.order.findUnique({
      where: { id: realOrderId },
      include: { items: true },
    });

    if (!currentOrder) {
      console.error('❌ Order not found in database!');
      throw new NotFoundException('Order not found');
    }

    console.log('✅ Order found:', {
      id: currentOrder.id,
      userId: currentOrder.userId,
      currentStatus: currentOrder.status,
      totalPrice: currentOrder.totalPrice,
    });

    // if already paid or canceled, ignore
    if (
      currentOrder.status === OrderStatus.PAID ||
      currentOrder.status === OrderStatus.CANCELED
    ) {
      console.log(
        '⚠️ Order already processed. Current status:',
        currentOrder.status,
      );
      return { status: 'ignored', message: 'Order already processed' };
    }

    // determine new status
    console.log('🎯 Determining new status based on transaction...');

    let newStatus: OrderStatus = OrderStatus.PENDING;
    if (transactionStatus === 'capture') {
      if (fraudStatus === 'challenge') {
        newStatus = OrderStatus.PROCESSING;
      } else if (fraudStatus === 'accept') {
        newStatus = OrderStatus.PAID;
      }
    } else if (transactionStatus === 'settlement') {
      newStatus = OrderStatus.PAID;
    } else if (
      transactionStatus === 'cancel' ||
      transactionStatus === 'deny' ||
      transactionStatus === 'expire' ||
      transactionStatus === 'failure'
    ) {
      newStatus = OrderStatus.CANCELED;
    }

    console.log('📌 New status determined:', {
      from: currentOrder.status,
      to: newStatus,
    });

    // update order status
    if (newStatus !== OrderStatus.PENDING) {
      console.log('💾 Updating order status in database...');

      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: realOrderId },
          data: {
            status: newStatus,
            paymentType: paymentType,
          },
        });

        console.log('✅ Order status updated to:', newStatus);

        // return stock if canceled
        if (newStatus === OrderStatus.CANCELED) {
          console.log('📦 Returning stock for canceled order...');
          for (const item of currentOrder.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
            console.log(
              `  ✅ Stock returned for product ${item.productId}: +${item.quantity}`,
            );
          }
        }
      });

      console.log('✅ Transaction completed successfully');
    } else {
      console.log('⚠️ Status still PENDING, no update needed');
    }

    console.log('📦 ===== MIDTRANS NOTIFICATION END =====');
    return { status: 'ok' };
  }

  // get my orders (pagination)
  async getMyOrders(userId: number, page = 1, limit = 10) {
    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        take: safeLimit,
        skip,
        include: {
          items: {
            include: {
              product: {
                include: { category: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: page * safeLimit < total,
        hasPrev: page > 1,
      },
    };
  }

  // get order details
  async getOrderDetails(userId: number, orderId: number, isAdmin: boolean) {
    console.log('🔍 Get Order Details Request:', {
      userId,
      orderId,
      isAdmin,
    });

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, email: true, name: true, phone: true },
        },
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
      },
    });

    if (!order) {
      console.error('❌ Order not found with ID:', orderId);
      throw new NotFoundException('Order not found');
    }

    console.log('✅ Order found:', {
      orderId: order.id,
      orderUserId: order.userId,
      requestUserId: userId,
      status: order.status,
    });

    if (!isAdmin && order.userId !== userId) {
      console.error('❌ Access denied:', {
        orderOwner: order.userId,
        requestUser: userId,
        isAdmin,
      });
      throw new ForbiddenException('You are not allowed to access this order');
    }

    console.log('✅ Access granted');
    return order;
  }

  // get all orders (admin)
  async getAllOrders(status?: OrderStatus, page = 1, limit = 20) {
    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;
    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        take: safeLimit,
        skip,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
          items: {
            include: {
              product: {
                include: { category: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: page * safeLimit < total,
        hasPrev: page > 1,
      },
    };
  }

  // update order status (admin)
  async updateOrderStatus(orderId: number, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // admin cancel then return stock
    if (
      dto.status === OrderStatus.CANCELED &&
      order.status !== OrderStatus.CANCELED
    ) {
      const canceledOrder = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.CANCELED },
          include: {
            user: { select: { id: true, email: true, name: true } },
            items: { include: { product: true } },
          },
        });

        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        return updated;
      });

      return {
        message: 'Order canceled by Admin. Stock returned.',
        order: canceledOrder,
      };
    }

    // normal status update
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: dto.status },
      include: {
        user: { select: { id: true, email: true, name: true } },
        items: { include: { product: true } },
      },
    });

    return {
      message: 'Order status updated successfully',
      order: updated,
    };
  }

  // cancel order (user only)
  async cancelOrder(userId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Order cannot be canceled. Current status: ' + order.status,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELED },
      });

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    });

    return {
      message: 'Order successfully canceled. Stock returned.',
    };
  }
  // get seller orders
  async getSellerOrders(
    sellerId: number,
    page = 1,
    limit = 10,
    status?: OrderStatus,
  ) {
    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;
    const whereCondition = {
      items: {
        some: {
          product: {
            sellerId: sellerId,
          },
        },
      },
      ...(status && { status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereCondition,
        take: safeLimit,
        skip,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: {
            where: {
              product: { sellerId: sellerId },
            },
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: whereCondition }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: page * safeLimit < total,
        hasPrev: page > 1,
      },
    };
  }
}
