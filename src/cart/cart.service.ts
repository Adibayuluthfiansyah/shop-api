import {
  Injectable,
  NotAcceptableException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCartDto } from './dto/update-cart.dto';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}
  //add to cart
  async addToCart(userId: number, dto: AddToCartDto) {
    //check product exists dan stock available
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotAcceptableException('Product not found');
    }
    if (product.stock < dto.quantity) {
      throw new BadRequestException(
        `Stock not sufficient. Available stock: ${product.stock}`,
      );
    }
    // check cart item already exists in cart user
    const existingCartItem = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: dto.productId,
        },
      },
    });
    //if existst, update quantity
    if (existingCartItem) {
      const newQuantity = existingCartItem.quantity + dto.quantity;
      if (newQuantity > product.stock) {
        throw new BadRequestException(
          `Stock not sufficient. Available stock: ${product.stock}`,
        );
      }
      const updatedCartItem = await this.prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: newQuantity },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });
      return {
        message: 'Cart item updated successfully',
        cartItem: updatedCartItem,
      };
    }
    //if not exists, create new cart item
    const cartItem = await this.prisma.cartItem.create({
      data: {
        userId,
        productId: dto.productId,
        quantity: dto.quantity,
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });
    return {
      message: 'Product added to cart successfully',
      cartItem,
    };
  }
  //get user cart
  async getUserCart(userId: number) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });
    //calculate total price
    const totalPrice = cartItems.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);

    return {
      items: cartItems,
      summary: {
        totalItems: cartItems.length,
        totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        totalPrice,
      },
    };
  }
  // update cart item quantity
  async updateCartItemQuantity(
    userId: number,
    cartItemId: number,
    dto: UpdateCartDto,
  ) {
    //check cart item user
    const cartItem = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, userId },
      include: { product: true },
    });
    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }
    //check stock available
    if (cartItem.product.stock < dto.quantity) {
      throw new BadRequestException(
        `Stock not sufficient. Available stock: ${cartItem.product.stock}`,
      );
    }
    // update quantity
    const updated = await this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: dto.quantity },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });
    return {
      message: 'Cart item quantity updated successfully',
      cartItem: updated,
    };
  }
  //remove cart item
  async removeCartItem(userId: number, cartItemId: number) {
    //check cart item exist and belongs to user
    const cartItem = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, userId },
    });
    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }
    //delete cart item
    await this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });
    return {
      message: 'Cart item removed successfully',
    };
  }
  //clear cart helper for order service
  async clearCart(userId: number) {
    await this.prisma.cartItem.deleteMany({
      where: { userId },
    });
    return {
      message: 'Cart cleared successfully',
    };
  }
}
