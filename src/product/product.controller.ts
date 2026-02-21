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
  BadRequestException,
  UploadedFile,
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
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Create new product',
    description: 'Create a new product (Seller or Admin only)',
  })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    type: ProductResponsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: { statusCode: 401, message: 'Unauthorized' },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires SELLER or ADMIN role',
    schema: {
      example: { statusCode: 403, message: 'Forbidden resource' },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: CurrentUserType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (file) {
      try {
        const result = await this.cloudinaryService.uploadImage(file);
        dto.imageUrl = result.url;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Cloudinary upload failed';
        throw new BadRequestException(`Image upload failed: ${errorMessage}`);
      }
    }
    return await this.productService.createProduct(dto, user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description:
      'Retrieve list of products with optional filters (search, category, price range) and pagination. Cached for 5 minutes.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by product name',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: Number,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    type: Number,
    description: 'Minimum price filter',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    type: Number,
    description: 'Maximum price filter',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'List of products',
    schema: {
      example: {
        data: [
          {
            id: 1,
            name: 'Product Name',
            description: 'Product description',
            price: '100000.00',
            stock: 50,
            imageUrl: 'https://example.com/image.jpg',
            categoryId: 1,
            sellerId: 1,
            createdAt: '2026-02-07T10:00:00.000Z',
            updatedAt: '2026-02-07T10:00:00.000Z',
            category: {
              id: 1,
              name: 'Electronics',
            },
          },
        ],
        meta: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10,
        },
      },
    },
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  findAll(@Query() query: QueryProductDto) {
    return this.productService.findAllProducts(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get product by ID',
    description:
      'Retrieve detailed information about a specific product. Cached for 5 minutes.',
  })
  @ApiParam({ name: 'id', description: 'Product ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Product details',
    type: ProductResponsDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
    schema: {
      example: { statusCode: 404, message: 'Product not found' },
    },
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findProductById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update product',
    description:
      'Update product information (Seller can only update their own products, Admin can update any)',
  })
  @ApiParam({ name: 'id', description: 'Product ID', type: Number })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
    schema: {
      example: {
        message: 'Product updated successfully',
        product: {
          id: 1,
          name: 'Updated Product Name',
          description: 'Updated description',
          price: '120000.00',
          stock: 45,
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
    description: 'Forbidden - Not the product owner',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
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

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete product',
    description:
      'Delete a product (Seller can only delete their own products, Admin can delete any)',
  })
  @ApiParam({ name: 'id', description: 'Product ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Product deleted successfully',
    schema: {
      example: {
        message: 'Product deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the product owner',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
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
