import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@ApiTags('Payment Methods')
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  @Post()
  @Roles('curator')
  @ApiOperation({ summary: 'Add a payment method (curator only)' })
  async create(@Request() req, @Body() dto: CreatePaymentMethodDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get('my')
  @Roles('curator')
  @ApiOperation({ summary: 'Get my payment methods (curator only)' })
  async findMy(@Request() req) {
    return this.service.findByCurator(req.user.id);
  }

  @Public()
  @Get('curator/:curatorId')
  @ApiOperation({ summary: 'Get active payment methods for a curator (public)' })
  async findByCurator(@Param('curatorId') curatorId: string) {
    return this.service.findByCuratorId(curatorId);
  }

  @Patch(':id')
  @Roles('curator')
  @ApiOperation({ summary: 'Update a payment method (curator only)' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @Roles('curator')
  @ApiOperation({ summary: 'Delete a payment method (curator only)' })
  async remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(req.user.id, id);
  }
}
