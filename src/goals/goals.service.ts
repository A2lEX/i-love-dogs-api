import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalStatusDto } from './dto/update-goal-status.dto';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyDogOwnership(
    dogId: string,
    userId: string,
    userRole: string,
  ) {
    if (userRole === 'admin') return;

    const dog = await this.prisma.dog.findUnique({
      where: { id: dogId },
      include: { curator: true },
    });

    if (!dog) {
      throw new NotFoundException('Dog not found');
    }

    if (dog.curator.user_id !== userId) {
      throw new ForbiddenException('You do not own this dog profile');
    }
  }

  async create(userId: string, userRole: string, data: CreateGoalDto) {
    await this.verifyDogOwnership(data.dog_id, userId, userRole);

    return this.prisma.goal.create({
      data: {
        dog_id: data.dog_id,
        created_by: userId,
        category: data.category,
        title: data.title,
        description: data.description,
        amount_target: data.amount_target,
        deadline: data.deadline ? new Date(data.deadline) : null,
        is_recurring: data.is_recurring ?? false,
        status: 'active',
      },
    });
  }

  async updateStatus(
    goalId: string,
    userId: string,
    userRole: string,
    data: UpdateGoalStatusDto,
  ) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      select: { dog_id: true },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.verifyDogOwnership(goal.dog_id, userId, userRole);

    return this.prisma.goal.update({
      where: { id: goalId },
      data: { status: data.status },
    });
  }

  async getDogGoals(dogId: string) {
    return this.prisma.goal.findMany({
      where: { dog_id: dogId },
      orderBy: { created_at: 'desc' },
      include: {
        creator: {
          select: { name: true },
        },
      },
    });
  }
}
