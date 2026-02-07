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
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { CurrentUserType } from 'src/auth/types/current-user.type';
import { UpdateCartDto } from './dto/update-cart.dto';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @ApiOperation({
    summary: 'Add item to cart',
    description:
      'Add a product to the shopping cart or increase quantity if already exists',
  })
  @ApiBody({ type: AddToCartDto })
  @ApiResponse({
    status: 201,
    description: 'Item added to cart successfully',
    schema: {
      example: {
        message: 'Item added to cart',
        cartItem: {
          id: 1,
          userId: 1,
          productId: 1,
          quantity: 2,
          product: {
            id: 1,
            name: 'Product Name',
            price: '100000.00',
            stock: 50,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid quantity or product not available',
  })
  addToCart(@CurrentUser() user: CurrentUserType, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get my cart',
    description:
      'Retrieve current user shopping cart with all items and total price',
  })
  @ApiResponse({
    status: 200,
    description: 'User cart details',
    type: CartResponseDto,
    schema: {
      example: {
        items: [
          {
            id: 1,
            userId: 1,
            productId: 1,
            quantity: 2,
            product: {
              id: 1,
              name: 'Product Name',
              description: 'Product description',
              price: '100000.00',
              stock: 50,
              imageUrl: 'https://example.com/image.jpg',
              category: {
                id: 1,
                name: 'Electronics',
              },
            },
          },
        ],
        totalPrice: 200000,
        totalItems: 2,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  getMyCart(@CurrentUser() user: CurrentUserType) {
    return this.cartService.getUserCart(user.userId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update cart item quantity',
    description: 'Update the quantity of a specific item in the cart',
  })
  @ApiParam({ name: 'id', description: 'Cart item ID', type: Number })
  @ApiBody({ type: UpdateCartDto })
  @ApiResponse({
    status: 200,
    description: 'Cart item updated successfully',
    schema: {
      example: {
        message: 'Cart item updated',
        cartItem: {
          id: 1,
          userId: 1,
          productId: 1,
          quantity: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Cart item not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid quantity or insufficient stock',
  })
  updateCartItem(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartDto,
  ) {
    return this.cartService.updateCartItemQuantity(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remove item from cart',
    description: 'Remove a specific item from the shopping cart',
  })
  @ApiParam({ name: 'id', description: 'Cart item ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Cart item removed successfully',
    schema: {
      example: {
        message: 'Item removed from cart',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Cart item not found',
  })
  removeCartItem(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cartService.removeCartItem(user.userId, id);
  }

  @Delete()
  @ApiOperation({
    summary: 'Clear cart',
    description: 'Remove all items from the shopping cart',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart cleared successfully',
    schema: {
      example: {
        message: 'Cart cleared',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  clearCart(@CurrentUser() user: CurrentUserType) {
    return this.cartService.clearCart(user.userId);
  }
}
