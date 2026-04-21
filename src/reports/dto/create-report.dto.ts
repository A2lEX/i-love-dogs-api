import {
  IsNotEmpty,
  IsUUID,
  IsIn,
  IsString,
  IsArray,
  IsUrl,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({ example: 'uuid-dog-id' })
  @IsUUID()
  @IsNotEmpty()
  dog_id: string;

  @ApiProperty({
    example: 'general',
    enum: ['general', 'medical', 'walk', 'adoption'],
  })
  @IsIn(['general', 'medical', 'walk', 'adoption'])
  type: 'general' | 'medical' | 'walk' | 'adoption';

  @ApiProperty({ example: 'Rex is doing very well today.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: ['https://minio.local/dogcare/report1.jpg'] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photo_urls?: string[];
}
