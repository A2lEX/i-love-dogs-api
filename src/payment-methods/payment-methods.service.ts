import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
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

  async create(userId: string, dto: CreatePaymentMethodDto) {
    const curatorId = await this.getCuratorProfileId(userId);

    return this.prisma.paymentMethod.create({
      data: {
        curator_id: curatorId,
        type: dto.type,
        label: dto.label,
        value: dto.value,
        sort_order: dto.sort_order ?? 0,
      },
    });
  }

  async findByCurator(userId: string) {
    const curatorId = await this.getCuratorProfileId(userId);

    return this.prisma.paymentMethod.findMany({
      where: { curator_id: curatorId },
      orderBy: { sort_order: 'asc' },
    });
  }

  async findByCuratorId(curatorId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { curator_id: curatorId, is_active: true },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        type: true,
        label: true,
        value: true,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdatePaymentMethodDto) {
    const curatorId = await this.getCuratorProfileId(userId);

    const method = await this.prisma.paymentMethod.findUnique({
      where: { id },
      select: { curator_id: true },
    });

    if (!method) throw new NotFoundException('Payment method not found');
    if (method.curator_id !== curatorId) {
      throw new ForbiddenException('You can only edit your own payment methods');
    }

    return this.prisma.paymentMethod.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    const curatorId = await this.getCuratorProfileId(userId);

    const method = await this.prisma.paymentMethod.findUnique({
      where: { id },
      select: { curator_id: true },
    });

    if (!method) throw new NotFoundException('Payment method not found');
    if (method.curator_id !== curatorId) {
      throw new ForbiddenException('You can only delete your own payment methods');
    }

    return this.prisma.paymentMethod.delete({ where: { id } });
  }
}
