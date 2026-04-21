import { Controller, Post, Body } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { CreateAnonDonationDto } from './dto/create-anon-donation.dto';
import { CreatePatronageSubscriptionDto } from './dto/create-patronage-subscription.dto';
import { YookassaWebhookDto } from './dto/yookassa-webhook.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @Post('donate')
  @ApiOperation({
    summary: 'Donate to a goal or generally to platform (Auth required)',
  })
  async createDonation(
    @CurrentUser() user: any,
    @Body() dto: CreateDonationDto,
  ) {
    return this.paymentsService.createGoalDonation(user.id, dto);
  }

  @Public()
  @Post('donate-anon')
  @ApiOperation({ summary: 'Anonymous donation to a goal' })
  async createAnonDonation(@Body() dto: CreateAnonDonationDto) {
    return this.paymentsService.createAnonDonation(dto);
  }

  @ApiBearerAuth()
  @Post('patronage')
  @ApiOperation({ summary: 'Subscribe to become a patron' })
  async createPatronageSubscription(
    @CurrentUser() user: any,
    @Body() dto: CreatePatronageSubscriptionDto,
  ) {
    return this.paymentsService.createPatronageSubscription(user.id, dto);
  }

  @Public()
  @Post('webhook/yookassa')
  @ApiOperation({ summary: 'YooKassa Webhook Handler' })
  async handleYookassaWebhook(@Body() dto: YookassaWebhookDto) {
    return this.paymentsService.handleWebhook(dto);
  }
}
