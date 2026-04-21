import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDogDto } from './dto/create-dog.dto';
import { UpdateDogDto } from './dto/update-dog.dto';
import { DogFilterDto } from './dto/dog-filter.dto';

@Injectable()
export class DogsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCuratorProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.curatorProfile.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });
    if (!profile) {
      throw new ForbiddenException('User does not have a curator profile');
    }
    return profile.id;
  }

  async create(userId: string, data: CreateDogDto) {
    const curatorId = await this.getCuratorProfileId(userId);

    return this.prisma.dog.create({
      data: {
        curator_id: curatorId,
        name: data.name,
        breed: data.breed || null,
        age_months: data.age_months || null,
        gender: data.gender,
        description: data.description,
        city: data.city,
        cover_photo_url: data.cover_photo_url || null,
        status: 'active',
      },
    });
  }

  async update(userId: string, dogId: string, data: UpdateDogDto) {
    const curatorId = await this.getCuratorProfileId(userId);

    const dog = await this.prisma.dog.findUnique({
      where: { id: dogId },
      select: { curator_id: true },
    });

    if (!dog) {
      throw new NotFoundException('Dog not found');
    }
    if (dog.curator_id !== curatorId) {
      throw new ForbiddenException('You can only edit your own dogs');
    }

    return this.prisma.dog.update({
      where: { id: dogId },
      data: {
        name: data.name,
        breed: data.breed,
        age_months: data.age_months,
        gender: data.gender,
        description: data.description,
        city: data.city,
        cover_photo_url: data.cover_photo_url,
        status: data.status,
      },
    });
  }

  async findAll(filter: DogFilterDto) {
    const where: any = {
      status: 'active',
    };

    if (filter.city)
      where.city = { contains: filter.city, mode: 'insensitive' };
    if (filter.gender) where.gender = filter.gender;
    if (filter.breed)
      where.breed = { contains: filter.breed, mode: 'insensitive' };

    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const [items, total] = await Promise.all([
      this.prisma.dog.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          curator: {
            select: { shelter_name: true, city: true },
          },
        },
      }),
      this.prisma.dog.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async findById(id: string) {
    const dog = await this.prisma.dog.findUnique({
      where: { id },
      include: {
        curator: {
          select: {
            id: true,
            shelter_name: true,
            city: true,
            description: true,
          },
        },
        goals: {
          where: { status: 'active' },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!dog) {
      throw new NotFoundException('Dog not found');
    }

    return dog;
  }
}
