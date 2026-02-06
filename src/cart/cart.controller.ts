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
import { ApiResponse } from '@nestjs/swagger/dist/decorators/api-response.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  //add to cart
  @Post()
  addToCart(@CurrentUser() user: CurrentUserType, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(user.userId, dto);
  }
  //get my cart
  @Get()
  @ApiResponse({
    status: 200,
    type: CartResponseDto,
    description: 'User cart details',
  })
  getMyCart(@CurrentUser() user: CurrentUserType) {
    return this.cartService.getUserCart(user.userId);
  }

  //update cart item
  @Patch(':id')
  updateCartItem(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartDto,
  ) {
    return this.cartService.updateCartItemQuantity(user.userId, id, dto);
  }
  //remove cart item
  @Delete(':id')
  removeCartItem(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cartService.removeCartItem(user.userId, id);
  }
  //clear cart
  @Delete()
  clearCart(@CurrentUser() user: CurrentUserType) {
    return this.cartService.clearCart(user.userId);
  }
}
