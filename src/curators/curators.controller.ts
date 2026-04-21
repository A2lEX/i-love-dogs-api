import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CuratorsService } from './curators.service';
import { CreateCuratorProfileDto } from './dto/create-curator-profile.dto';
import { VerifyCuratorDto } from './dto/verify-curator.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Curators')
@Controller('curators')
export class CuratorsController {
  constructor(private readonly curatorsService: CuratorsService) {}

  @ApiBearerAuth()
  @Post('profile')
  @ApiOperation({
    summary: 'Create or update curator profile (for current user)',
  })
  async upsertProfile(
    @CurrentUser() user: any,
    @Body() dto: CreateCuratorProfileDto,
  ) {
    return this.curatorsService.upsertProfile(user.id, dto);
  }

  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current user curator profile' })
  async getMyProfile(@CurrentUser() user: any) {
    return this.curatorsService.getProfile(user.id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get public curator profile by ID' })
  async getProfileById(@Param('id') id: string) {
    return this.curatorsService.getProfileById(id);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify or reject curator profile (Admin only)' })
  async verifyCurator(
    @Param('id') id: string,
    @CurrentUser() admin: any,
    @Body() dto: VerifyCuratorDto,
  ) {
    return this.curatorsService.verifyCurator(id, admin.id, dto);
  }
}
