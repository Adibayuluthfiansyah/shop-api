import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  // create order
  async createOrder(userId: number) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      select: {
        quantity: true,
        productId: true,
        product: {
          select: {
            name: true,
            price: true,
          },
        },
      },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    if (cartItems.length > 50) {
      throw new BadRequestException('Too many items in cart (Max 50)');
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
        },
      });

      // create order items
      await tx.orderItem.createMany({
        data: cartItems.map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.product.price,
        })),
      });

      // clear cart
      await tx.cartItem.deleteMany({ where: { userId } });

      // return created order
      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  category: true,
                },
              },
            },
          },
        },
      });
    });

    return {
      message: 'Order created successfully',
      order,
    };
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
}
