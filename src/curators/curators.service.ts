import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCuratorProfileDto } from './dto/create-curator-profile.dto';
import { VerifyCuratorDto } from './dto/verify-curator.dto';

@Injectable()
export class CuratorsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertProfile(userId: string, data: CreateCuratorProfileDto) {
    return this.prisma.curatorProfile.upsert({
      where: { user_id: userId },
      update: {
        shelter_name: data.shelter_name,
        address: data.address,
        city: data.city,
        description: data.description,
        verify_status: 'pending', // Re-verify on edit? Depending on rules. Let's keep existing status unless explicitly rules say otherwise. Actually Prisma upsert doesn't let us easily ignore verify_status. Let's make it pending on creation, but preserve on update if we want.
      },
      create: {
        user_id: userId,
        shelter_name: data.shelter_name,
        address: data.address,
        city: data.city,
        description: data.description,
        verify_status: 'pending',
      },
    });
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.curatorProfile.findUnique({
      where: { user_id: userId },
      include: {
        dogs: {
          select: { id: true, name: true, status: true, cover_photo_url: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Curator profile not found for this user');
    }

    return profile;
  }

  async getProfileById(curatorId: string) {
    const profile = await this.prisma.curatorProfile.findUnique({
      where: { id: curatorId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        dogs: {
          where: { status: 'active' },
          select: {
            id: true,
            name: true,
            gender: true,
            city: true,
            cover_photo_url: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Curator not found');
    }

    return profile;
  }

  async verifyCurator(
    curatorId: string,
    adminId: string,
    data: VerifyCuratorDto,
  ) {
    const profile = await this.prisma.curatorProfile.findUnique({
      where: { id: curatorId },
    });

    if (!profile) {
      throw new NotFoundException('Curator not found');
    }

    const updated = await this.prisma.curatorProfile.update({
      where: { id: curatorId },
      data: {
        verify_status: data.verify_status,
        rejection_note: data.rejection_note || null,
        verified_at: data.verify_status === 'verified' ? new Date() : null,
        verified_by: adminId,
      },
    });

    // Update User Role to Curator if verified
    if (data.verify_status === 'verified') {
      await this.prisma.user.update({
        where: { id: profile.user_id },
        data: { role: 'curator' },
      });
    }

    return updated;
  }
}
