import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CategoryService } from './category.service';
import { UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { CreateCategoryDto } from './dto/create-category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new category',
    description: 'Create a new product category (Admin only)',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    schema: {
      example: {
        message: 'Category created successfully',
        category: {
          id: 1,
          name: 'Electronics',
        },
      },
    },
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
    description: 'Forbidden - Requires ADMIN role',
    schema: {
      example: { statusCode: 403, message: 'Forbidden resource' },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Category already exists',
    schema: {
      example: { statusCode: 409, message: 'Category already exists' },
    },
  })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.createCategory(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all categories',
    description:
      'Retrieve list of all product categories. Cached for 5 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of categories',
    schema: {
      example: [
        {
          id: 1,
          name: 'Electronics',
        },
        {
          id: 2,
          name: 'Fashion',
        },
        {
          id: 3,
          name: 'Books',
        },
      ],
    },
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  getAllCategories() {
    return this.categoryService.getAllCategories();
  }
}
