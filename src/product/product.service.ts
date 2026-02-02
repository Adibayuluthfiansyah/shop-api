import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  //create product(Admin Only)
  async createProduct(dto: CreateProductDto) {
    //check category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    const product = await this.prisma.product.create({
      data: dto,
      include: {
        category: true,
      },
    });
    return {
      message: 'Product created successfully',
      product,
    };
  }

  //get all products with pagination, search, filter, sort
  async findAllProducts(query: QueryProductDto) {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      sortBy = 'createdAt',
      order = 'desc',
    } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    // get data total count
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: { category: true },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
  // get product by id
  async findProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  //update product(Admin Only)
  async updateProduct(id: number, dto: UpdateProductDto) {
    //check product exists
    await this.findProductById(id);

    //if update product then check categoryId
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }
    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
    return {
      message: 'Product updated successfully',
      product,
    };
  }
  // delete product(admin only)
  async deleteProduct(id: number) {
    //check product exists
    await this.findProductById(id);
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Product deleted successfully' };
  }
}
