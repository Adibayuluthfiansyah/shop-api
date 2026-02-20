import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PrismaService } from '../prisma/prisma.service';
import { timingSafeEqual } from 'crypto';
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
  private readonly logger = new Logger(OrderService.name);
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
  async createOrder(userId: string) {
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
    const verifySignature = crypto
      .createHash('sha512')
      .update(
        notificationJson.order_id +
          notificationJson.status_code +
          notificationJson.gross_amount +
          process.env.MIDTRANS_SERVER_KEY,
      )
      .digest('hex');

    try {
      const expectedBuffer = Buffer.from(verifySignature, 'hex');
      const providedBuffer = Buffer.from(notificationJson.signature_key, 'hex');

      if (expectedBuffer.length !== providedBuffer.length) {
        this.logger.warn('Invalid signature: length mismatch');
        throw new ForbiddenException('Unauthorized');
      }

      if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
        this.logger.warn('Invalid signature: comparison failed');
        throw new ForbiddenException('Unauthorized');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Signature verification error: ${error.message}`);
      throw new ForbiddenException('Unauthorized');
    }

    if (verifySignature !== notificationJson.signature_key) {
      throw new BadRequestException('Invalid Signature Key');
    }

    // double check status
    let statusResponse;
    try {
      statusResponse =
        await this.apiClient.transaction.notification(notificationJson);
    } catch (error) {
      throw new BadRequestException(
        `Failed to check status with Midtrans: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;
    const paymentType = statusResponse.payment_type;
    const grossAmount = statusResponse.gross_amount;

    // get real order ID
    const realOrderId = Number(orderId.split('-')[1]);
    if (isNaN(realOrderId)) {
      throw new BadRequestException('Invalid order ID in notification');
    }

    return await this.prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: realOrderId },
        include: { items: true },
      });

      if (!currentOrder) {
        throw new NotFoundException('Order not found');
      }

      // make sure nominal match
      if (Number(currentOrder.totalPrice) !== Number(grossAmount)) {
        this.logger.error(
          `FRAUD ALERT: Amount mismatch detected!
           Order ID: ${realOrderId}
           Expected: ${currentOrder.totalPrice.toString()}
           Received: ${grossAmount}
           User: ${currentOrder.userId}`,
        );

        // cancel order not match
        await tx.order.update({
          where: { id: realOrderId },
          data: {
            status: OrderStatus.CANCELED,
          },
        });

        // back stock
        for (const item of currentOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        throw new BadRequestException(
          'Payment verification failed: Amount Mismatch',
        );
      }

      // check status
      if (
        currentOrder.status === OrderStatus.PAID ||
        currentOrder.status === OrderStatus.CANCELED
      ) {
        return { status: 'ignored', message: 'Order already processed' };
      }

      let potentialStatus: OrderStatus | null = null;

      if (transactionStatus === 'capture') {
        if (fraudStatus === 'accept') {
          potentialStatus = OrderStatus.PAID;
        }
      } else if (transactionStatus === 'settlement') {
        potentialStatus = OrderStatus.PAID;
      } else if (
        transactionStatus === 'cancel' ||
        transactionStatus === 'deny' ||
        transactionStatus === 'expire' ||
        transactionStatus === 'failure'
      ) {
        potentialStatus = OrderStatus.CANCELED;
      }

      // check status
      if (
        !potentialStatus ||
        potentialStatus === (currentOrder.status as OrderStatus)
      ) {
        return { status: 'ignored', message: 'No status change required' };
      }

      // update status normal
      await tx.order.update({
        where: { id: realOrderId },
        data: {
          status: potentialStatus,
          paymentType: paymentType,
        },
      });

      // refund stock if cancelled
      if (potentialStatus === OrderStatus.CANCELED) {
        for (const item of currentOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
        this.logger.log(`Order ${realOrderId} canceled. Stock returned.`);
      } else {
        this.logger.log(`Order ${realOrderId} updated to ${potentialStatus}`);
      }

      return { status: 'ok' };
    });
  }

  // get my orders (pagination)
  async getMyOrders(userId: string, page = 1, limit = 10) {
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
  async getOrderDetails(userId: string, orderId: number, isAdmin: boolean) {
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
      throw new NotFoundException('Order not found');
    }

    if (!isAdmin && order.userId !== userId) {
      throw new ForbiddenException('You are not allowed to access this order');
    }

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
  async cancelOrder(userId: string, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, status: OrderStatus.PENDING },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // if (order.status !== OrderStatus.PENDING) {
    //   throw new BadRequestException(
    //     'Order cannot be canceled. Current status: ' + order.status,
    //   );
    // }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          userId,
          status: OrderStatus.PENDING,
        },
        data: { status: OrderStatus.CANCELED },
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          'Order cannot be canceled. Current status ',
        );
      }

      //refund stock
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
    sellerId: string,
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
