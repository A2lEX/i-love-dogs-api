import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { CreateAnonDonationDto } from './dto/create-anon-donation.dto';
import { CreatePatronageSubscriptionDto } from './dto/create-patronage-subscription.dto';
import { YookassaWebhookDto } from './dto/yookassa-webhook.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createGoalDonation(userId: string, data: CreateDonationDto) {
    if (data.goal_id) {
      const goal = await this.prisma.goal.findUnique({
        where: { id: data.goal_id },
      });
      if (!goal) throw new NotFoundException('Goal not found');
    }

    const providerRef = `mock-yk-${uuidv4()}`;

    const payment = await this.prisma.payment.create({
      data: {
        user_id: userId,
        goal_id: data.goal_id || null,
        amount: data.amount,
        provider: 'yookassa',
        provider_ref: providerRef,
        status: 'pending',
      },
    });

    return {
      payment_id: payment.id,
      provider_ref: providerRef,
      confirmation_url: `https://yoomoney.ru/checkout/payments/v2/contract?orderId=${providerRef}`,
      metadata: { goal_id: data.goal_id }, // Sent to YooKassa in real life
    };
  }

  async createAnonDonation(data: CreateAnonDonationDto) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: data.goal_id },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const providerRef = `mock-yk-anon-${uuidv4()}`;

    const donation = await this.prisma.anonDonation.create({
      data: {
        goal_id: data.goal_id,
        email: data.email,
        display_name: data.display_name,
        amount: data.amount,
        provider: 'yookassa',
        provider_ref: providerRef,
        status: 'pending',
      },
    });

    return {
      donation_id: donation.id,
      provider_ref: providerRef,
      confirmation_url: `https://yoomoney.ru/checkout/payments/v2/contract?orderId=${providerRef}`,
      metadata: { anon_donation_id: donation.id },
    };
  }

  async createPatronageSubscription(
    userId: string,
    data: CreatePatronageSubscriptionDto,
  ) {
    const dog = await this.prisma.dog.findUnique({
      where: { id: data.dog_id },
    });
    if (!dog) throw new NotFoundException('Dog not found');

    const activePatronage = await this.prisma.patronage.findFirst({
      where: { dog_id: data.dog_id, status: 'active', user_id: userId },
    });
    if (activePatronage)
      throw new BadRequestException(
        'You are already an active patron for this dog.',
      );

    const providerRef = `mock-yk-sub-${uuidv4()}`;

    const payment = await this.prisma.payment.create({
      data: {
        user_id: userId,
        amount: data.amount,
        provider: 'yookassa',
        provider_ref: providerRef,
        status: 'pending',
      },
    });

    return {
      payment_id: payment.id,
      provider_ref: providerRef,
      confirmation_url: `https://yoomoney.ru/checkout/payments/v2/contract?orderId=${providerRef}`,
      metadata: {
        patronage_dog_id: data.dog_id,
        patronage_type: data.type,
      }, // In real world, send this metadata object to YooKassa
    };
  }

  async handleWebhook(data: YookassaWebhookDto) {
    const providerRef = data.object.id; // Yookassa payment id

    if (data.event !== 'payment.succeeded') {
      this.logger.log(
        `Received non-success event: ${data.event} for ${providerRef}`,
      );
      return { success: true, message: 'Ignored non-success event' };
    }

    // 1. Try finding AnonDonation
    const anonDonation = await this.prisma.anonDonation.findUnique({
      where: { provider_ref: providerRef },
    });
    if (anonDonation && anonDonation.status === 'pending') {
      await this.prisma.$transaction(async (tx) => {
        await tx.anonDonation.update({
          where: { id: anonDonation.id },
          data: { status: 'succeeded' },
        });

        const goal = await tx.goal.findUnique({
          where: { id: anonDonation.goal_id },
        });
        if (goal) {
          const newAmount = goal.amount_collected + anonDonation.amount;
          await tx.goal.update({
            where: { id: goal.id },
            data: {
              amount_collected: newAmount,
              status:
                newAmount >= goal.amount_target ? 'completed' : goal.status,
            },
          });
        }
      });
      return { success: true };
    }

    // 2. Try finding Payment
    const payment = await this.prisma.payment.findUnique({
      where: { provider_ref: providerRef },
    });
    if (payment && payment.status === 'pending') {
      await this.prisma.$transaction(async (tx) => {
        // Mark payment succeeded
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'succeeded' },
        });

        // 2A. Is this a Goal payment?
        if (payment.goal_id) {
          const goal = await tx.goal.findUnique({
            where: { id: payment.goal_id },
          });
          if (goal) {
            const newAmount = goal.amount_collected + payment.amount;
            await tx.goal.update({
              where: { id: goal.id },
              data: {
                amount_collected: newAmount,
                status:
                  newAmount >= goal.amount_target ? 'completed' : goal.status,
              },
            });
          }
        }

        // 2B. Is this a Patronage subscription payment? (check metadata from webhook)
        const metadata = data.object.metadata || {};
        if (metadata.patronage_dog_id && metadata.patronage_type) {
          // create patronage
          const patronage = await tx.patronage.create({
            data: {
              user_id: payment.user_id,
              dog_id: metadata.patronage_dog_id,
              type: metadata.patronage_type,
              status: 'active',
            },
          });

          // Link the payment to the newly created patronage
          await tx.payment.update({
            where: { id: payment.id },
            data: { patronage_id: patronage.id },
          });
        }
      });
      return { success: true };
    }

    return { success: true, message: 'Payment already processed or not found' };
  }
}
