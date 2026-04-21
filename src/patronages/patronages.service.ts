import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatronageDto } from './dto/create-patronage.dto';
import { UpdatePatronageStatusDto } from './dto/update-patronage-status.dto';

@Injectable()
export class PatronagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: CreatePatronageDto) {
    const dog = await this.prisma.dog.findUnique({
      where: { id: data.dog_id },
    });

    if (!dog) {
      throw new NotFoundException('Dog not found');
    }

    // Checking for exclusive rule
    const activePatronages = await this.prisma.patronage.findMany({
      where: { dog_id: data.dog_id, status: 'active' },
    });

    const hasExclusive = activePatronages.some((p) => p.type === 'exclusive');
    if (hasExclusive) {
      throw new BadRequestException(
        'This dog already has an exclusive patron.',
      );
    }

    if (data.type === 'exclusive' && activePatronages.length > 0) {
      throw new BadRequestException(
        'Cannot become an exclusive patron because this dog already has regular patrons.',
      );
    }

    // Check if user already patronizes this dog
    const existing = await this.prisma.patronage.findFirst({
      where: { user_id: userId, dog_id: data.dog_id, status: 'active' },
    });

    if (existing) {
      throw new BadRequestException('You are already a patron of this dog.');
    }

    return this.prisma.patronage.create({
      data: {
        user_id: userId,
        dog_id: data.dog_id,
        type: data.type,
        status: 'active', // For now create active instantly. In Phase 4, will be pending until payment.
      },
    });
  }

  async updateStatus(
    patronageId: string,
    userId: string,
    data: UpdatePatronageStatusDto,
  ) {
    const patronage = await this.prisma.patronage.findUnique({
      where: { id: patronageId },
    });

    if (!patronage) {
      throw new NotFoundException('Patronage record not found');
    }

    if (patronage.user_id !== userId) {
      throw new ForbiddenException('You do not own this patronage record');
    }

    return this.prisma.patronage.update({
      where: { id: patronageId },
      data: { status: data.status },
    });
  }

  async getMyPatronages(userId: string) {
    return this.prisma.patronage.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        dog: {
          select: { id: true, name: true, cover_photo_url: true, city: true },
        },
      },
    });
  }

  async getDogPatrons(dogId: string) {
    return this.prisma.patronage.findMany({
      where: { dog_id: dogId, status: 'active' },
      select: {
        id: true,
        type: true,
        created_at: true,
        user: { select: { name: true } },
      },
    });
  }
}
