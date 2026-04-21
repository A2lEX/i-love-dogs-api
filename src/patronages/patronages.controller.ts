import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { PatronagesService } from './patronages.service';
import { CreatePatronageDto } from './dto/create-patronage.dto';
import { UpdatePatronageStatusDto } from './dto/update-patronage-status.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Patronages')
@Controller('patronages')
export class PatronagesController {
  constructor(private readonly patronagesService: PatronagesService) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Become a patron of a dog' })
  async create(@CurrentUser() user: any, @Body() dto: CreatePatronageDto) {
    return this.patronagesService.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Put(':id/status')
  @ApiOperation({ summary: 'Update patronage status (cancel/pause)' })
  @ApiParam({ name: 'id', description: 'Patronage ID' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdatePatronageStatusDto,
  ) {
    return this.patronagesService.updateStatus(id, user.id, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user patronages' })
  async getMyPatronages(@CurrentUser() user: any) {
    return this.patronagesService.getMyPatronages(user.id);
  }

  @Public()
  @Get('dog/:dogId')
  @ApiOperation({ summary: 'Get list of active patrons for a specific dog' })
  @ApiParam({ name: 'dogId', description: 'Dog UUID' })
  async getDogPatrons(@Param('dogId') dogId: string) {
    return this.patronagesService.getDogPatrons(dogId);
  }
}
