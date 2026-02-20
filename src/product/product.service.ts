import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  //create product(Admin Only)
  async createProduct(dto: CreateProductDto, sellerId: string) {
    //check category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    const product = await this.prisma.product.create({
      data: {
        ...dto,
        sellerId,
      },
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

  //update product(Seller & Admin)
  async updateProduct(
    id: number,
    dto: UpdateProductDto,
    userId: string,
    userRole: Role,
  ) {
    //check product exists
    const product = await this.findProductById(id);
    //admin can update any product
    if (userRole !== Role.ADMIN && product.sellerId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to update this product',
      );
    }

    //if update product then check categoryId
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }
    const productUpdate = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
    return {
      message: 'Product updated successfully',
      product: productUpdate,
    };
  }
  // delete product(admin seller)
  async deleteProduct(id: number, userId: string, userRole: Role) {
    //check product exists
    const product = await this.findProductById(id);

    //check role
    if (userRole !== Role.ADMIN && product.sellerId !== userId) {
      throw new ForbiddenException('Youre Not Allowed Delete This Product');
    }

    // delete product
    const deleted = await this.prisma.product.deleteMany({
      where: {
        id,
        ...(userRole !== Role.ADMIN ? { sellerId: userId } : {}),
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Product not found or already deleted');
    }

    return {
      message: 'Product deleted successfully',
    };

    //check if the user is the owner of the product
    // if (!product) {
    //   throw new NotFoundException('Product not found');
    // }
    // if (userRole !== Role.ADMIN && product.sellerId !== userId) {
    //   throw new ForbiddenException(
    //     'You are not allowed to delete this product',
    //   );
    // }
    // await this.prisma.product.delete({ where: { id } });
    // return { message: 'Product deleted successfully' };
  }
}
