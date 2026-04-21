import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
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
  constructor(private readonly reportsService: ReportsService) {}

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
