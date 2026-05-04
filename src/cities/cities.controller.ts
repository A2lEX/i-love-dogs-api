import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CitiesService } from './cities.service';

@ApiTags('Cities')
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get cities, optionally filtered by country code' })
  @ApiQuery({ name: 'country', required: false, example: 'ME' })
  async findAll(@Query('country') country?: string) {
    if (country) {
      return this.citiesService.findByCountry(country);
    }
    return [];
  }
}
