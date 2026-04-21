import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWalkDto } from './dto/create-walk.dto';
import { UpdateWalkStatusDto } from './dto/update-walk-status.dto';
import { SubmitWalkReportDto } from './dto/submit-walk-report.dto';

@Injectable()
export class WalksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: CreateWalkDto) {
    const dog = await this.prisma.dog.findUnique({
      where: { id: data.dog_id },
    });
    if (!dog) throw new NotFoundException('Dog not found');

    const scheduledDate = new Date(data.scheduled_at);

    // Check if there's already a confirmed walk at this exact time (simple overlap shield)
    // A better shield would check ranges, but this is a good start.
    const conflicting = await this.prisma.walk.findFirst({
      where: {
        dog_id: data.dog_id,
        status: { in: ['confirmed', 'started'] },
        scheduled_at: scheduledDate,
      },
    });

    if (conflicting) {
      throw new BadRequestException(
        'This dog already has a confirmed walk at this time.',
      );
    }

    return this.prisma.walk.create({
      data: {
        dog_id: data.dog_id,
        walker_id: userId,
        scheduled_at: scheduledDate,
        duration_min: data.duration_min,
        notes: data.notes,
        status: 'pending',
      },
    });
  }

  async updateStatus(
    walkId: string,
    userId: string,
    userRole: string,
    data: UpdateWalkStatusDto,
  ) {
    const walk = await this.prisma.walk.findUnique({
      where: { id: walkId },
      include: { dog: { include: { curator: true } } },
    });

    if (!walk) throw new NotFoundException('Walk not found');

    const isWalker = walk.walker_id === userId;
    const isCuratorOrAdmin =
      userRole === 'admin' ||
      (walk.dog.curator && walk.dog.curator.user_id === userId);

    if (!isWalker && !isCuratorOrAdmin) {
      throw new ForbiddenException(
        'You do not have permission to modify this walk.',
      );
    }

    // Role specific restrictions could be added here (e.g. walker can only start/cancel, curator can confirm/reject)
    // For simplicity, we trust the authorized party if they pass the check

    return this.prisma.walk.update({
      where: { id: walkId },
      data: { status: data.status },
    });
  }

  async submitReport(
    walkId: string,
    userId: string,
    data: SubmitWalkReportDto,
  ) {
    const walk = await this.prisma.walk.findUnique({ where: { id: walkId } });
    if (!walk) throw new NotFoundException('Walk not found');
    if (walk.walker_id !== userId)
      throw new ForbiddenException('Only the walker can submit a report.');

    return this.prisma.walk.update({
      where: { id: walkId },
      data: {
        report_text: data.report_text,
        report_photo_url: data.report_photo_url,
        status: 'completed',
      },
    });
  }

  async getMyWalks(userId: string) {
    return this.prisma.walk.findMany({
      where: { walker_id: userId },
      orderBy: { scheduled_at: 'asc' },
      include: {
        dog: { select: { name: true, cover_photo_url: true } },
      },
    });
  }

  async getDogWalks(dogId: string) {
    return this.prisma.walk.findMany({
      where: {
        dog_id: dogId,
        status: { in: ['pending', 'confirmed', 'started'] },
        scheduled_at: { gte: new Date() },
      },
      orderBy: { scheduled_at: 'asc' },
      select: {
        id: true,
        scheduled_at: true,
        duration_min: true,
        status: true,
      },
    });
  }
}
