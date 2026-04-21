import { Controller, Get, Post, Body, Param, Put, Query } from '@nestjs/common';
import { DogsService } from './dogs.service';
import { CreateDogDto } from './dto/create-dog.dto';
import { UpdateDogDto } from './dto/update-dog.dto';
import { DogFilterDto } from './dto/dog-filter.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Dogs')
@Controller('dogs')
export class DogsController {
  constructor(private readonly dogsService: DogsService) {}

  @ApiBearerAuth()
  @Roles('curator', 'admin')
  @Post()
  @ApiOperation({ summary: 'Create a new dog profile (Curator/Admin only)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateDogDto) {
    return this.dogsService.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Roles('curator', 'admin')
  @Put(':id')
  @ApiOperation({ summary: 'Update a dog profile (Curator/Admin only)' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateDogDto,
  ) {
    // Admins might be able to edit any dog in future, but for now restricted to owner inside service
    return this.dogsService.update(user.id, id, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get catalog of dogs with filters' })
  async findAll(@Query() filter: DogFilterDto) {
    return this.dogsService.findAll(filter);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific dog' })
  async findById(@Param('id') id: string) {
    return this.dogsService.findById(id);
  }
}
