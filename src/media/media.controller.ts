import { Controller, Post, Body } from '@nestjs/common';
import { MediaService } from './media.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';

class PresignedUrlDto {
  @ApiProperty({ example: 'dog.jpg' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  content_type: string;
}

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presigned-url')
  @ApiOperation({
    summary: 'Get presigned URL for file upload',
  })
  async getPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.mediaService.generatePresignedUrl(
      dto.filename,
      dto.content_type,
    );
  }
}
