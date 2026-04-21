import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { WalksService } from './walks.service';
import { CreateWalkDto } from './dto/create-walk.dto';
import { UpdateWalkStatusDto } from './dto/update-walk-status.dto';
import { SubmitWalkReportDto } from './dto/submit-walk-report.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Walks')
@Controller('walks')
export class WalksController {
  constructor(private readonly walksService: WalksService) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Request a dog walk' })
  async create(@CurrentUser() user: any, @Body() dto: CreateWalkDto) {
    return this.walksService.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Put(':id/status')
  @ApiOperation({ summary: 'Update walk status' })
  @ApiParam({ name: 'id', description: 'Walk ID' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateWalkStatusDto,
  ) {
    return this.walksService.updateStatus(id, user.id, user.role, dto);
  }

  @ApiBearerAuth()
  @Post(':id/report')
  @ApiOperation({ summary: 'Submit a report after the walk is finished' })
  @ApiParam({ name: 'id', description: 'Walk ID' })
  async submitReport(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: SubmitWalkReportDto,
  ) {
    return this.walksService.submitReport(id, user.id, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user scheduled and past walks' })
  async getMyWalks(@CurrentUser() user: any) {
    return this.walksService.getMyWalks(user.id);
  }

  @Public()
  @Get('dog/:dogId')
  @ApiOperation({ summary: 'Get upcoming public walks for a dog' })
  @ApiParam({ name: 'dogId', description: 'Dog UUID' })
  async getDogWalks(@Param('dogId') dogId: string) {
    return this.walksService.getDogWalks(dogId);
  }
}
