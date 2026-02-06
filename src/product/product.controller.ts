import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { CurrentUserType } from 'src/auth/types/current-user.type';
import { ProductResponsDto } from './dto/product-respons.dto';
import { ApiResponse } from '@nestjs/swagger';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}
  // create product (seller only)
  @Post()
  @ApiResponse({
    status: 201,
    type: ProductResponsDto,
    description: 'Product created successfully',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  create(@Body() dto: CreateProductDto, @CurrentUser() user: CurrentUserType) {
    return this.productService.createProduct(dto, user.userId);
  }

  //get all products
  @Get()
  @ApiResponse({
    status: 200,
    type: [ProductResponsDto],
    description: 'List of products',
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  findAll(@Query() query: QueryProductDto) {
    return this.productService.findAllProducts(query);
  }

  // get product by id
  @Get(':id')
  @ApiResponse({
    status: 200,
    type: ProductResponsDto,
    description: 'Product details',
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findProductById(id);
  }

  //update product (seller admin)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.productService.updateProduct(
      id,
      dto,
      user.userId,
      user.role as Role,
    );
  }

  // delete product (seller only)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.productService.deleteProduct(
      id,
      user.userId,
      user.role as Role,
    );
  }
}
