import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalStatusDto } from './dto/update-goal-status.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Goals')
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @ApiBearerAuth()
  @Roles('curator', 'admin')
  @Post()
  @ApiOperation({ summary: 'Create a funding goal (Curator/Admin only)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(user.id, user.role, dto);
  }

  @ApiBearerAuth()
  @Roles('curator', 'admin')
  @Put(':id/status')
  @ApiOperation({ summary: 'Update goal status (Curator/Admin only)' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateGoalStatusDto,
  ) {
    return this.goalsService.updateStatus(id, user.id, user.role, dto);
  }

  @Public()
  @Get('dog/:dogId')
  @ApiOperation({ summary: 'Get all goals for a specific dog' })
  @ApiParam({ name: 'dogId', description: 'Dog UUID' })
  async getDogGoals(@Param('dogId') dogId: string) {
    return this.goalsService.getDogGoals(dogId);
  }
}
