import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyCuratorDto {
  @ApiProperty({ example: 'verified', enum: ['verified', 'rejected'] })
  @IsIn(['verified', 'rejected'])
  verify_status: 'verified' | 'rejected';

  @ApiPropertyOptional({ example: 'Documents missing' })
  @IsOptional()
  @IsString()
  rejection_note?: string;
}
