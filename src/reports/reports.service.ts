import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, userRole: string, data: CreateReportDto) {
    if (userRole !== 'admin') {
      const dog = await this.prisma.dog.findUnique({
        where: { id: data.dog_id },
        include: { curator: true },
      });

      if (!dog) {
        throw new NotFoundException('Dog not found');
      }

      if (dog.curator.user_id !== userId) {
        throw new ForbiddenException(
          'You must be the curator of this dog to post reports.',
        );
      }
    }

    return this.prisma.report.create({
      data: {
        dog_id: data.dog_id,
        curator_id: userId,
        type: data.type,
        content: data.content,
        photo_urls: data.photo_urls || [],
      },
    });
  }

  async getDogReports(dogId: string) {
    return this.prisma.report.findMany({
      where: { dog_id: dogId },
      orderBy: { created_at: 'desc' },
      include: {
        curator: {
          select: { name: true },
        },
      },
    });
  }
}
