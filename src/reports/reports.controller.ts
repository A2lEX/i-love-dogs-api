import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ContactFormDto } from './dto/contact-form.dto';
import { MailerService } from '../common/services/mailer.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);
  constructor(
    private readonly reportsService: ReportsService,
    private readonly mailerService: MailerService,
  ) {}

  @Public()
  @Post('contact')
  @ApiOperation({ summary: 'Send a contact form message' })
  async contact(@Body() dto: ContactFormDto) {
    this.logger.log(`New contact message from ${dto.email} (${dto.name})`);
    try {
      await this.mailerService.sendContactForm(dto);
      return { success: true, message: 'Message delivered' };
    } catch (error) {
      this.logger.error(`Contact form delivery failed: ${error.message}`);
      return { success: false, message: 'Delivery failed' };
    }
  }

  @ApiBearerAuth()
  @Roles('curator', 'admin')
  @Post()
  @ApiOperation({ summary: 'Create a report for a dog (Curator/Admin only)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, user.role, dto);
  }

  @Public()
  @Get('dog/:dogId')
  @ApiOperation({ summary: 'Get all reports for a specific dog' })
  @ApiParam({ name: 'dogId', description: 'Dog UUID' })
  async getDogReports(@Param('dogId') dogId: string) {
    return this.reportsService.getDogReports(dogId);
  }
}
