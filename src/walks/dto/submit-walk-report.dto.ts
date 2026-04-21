import { IsNotEmpty, IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitWalkReportDto {
  @ApiProperty({ example: 'The dog was very active and happy!' })
  @IsString()
  @IsNotEmpty()
  report_text: string;

  @ApiPropertyOptional({ example: 'https://minio.local/dogcare/walk123.jpg' })
  @IsOptional()
  @IsUrl()
  report_photo_url?: string;
}
