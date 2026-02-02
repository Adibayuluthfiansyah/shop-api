import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  //create category
  async createCategory(dto: CreateCategoryDto) {
    //check if category name already exists
    const existingCategory = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });
    if (existingCategory) {
      throw new ConflictException('Category name already exists');
    }
    const category = await this.prisma.category.create({
      data: dto,
    });
    return {
      message: 'Category created successfully',
      category,
    };
  }

  //get all categories
  async getAllCategories() {
    return this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }
}
