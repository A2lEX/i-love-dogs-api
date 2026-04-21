import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWalkDto {
  @ApiProperty({ example: 'uuid-dog-id' })
  @IsUUID()
  @IsNotEmpty()
  dog_id: string;

  @ApiProperty({ example: '2026-04-01T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  scheduled_at: string;

  @ApiProperty({ example: 60, description: 'Duration in minutes' })
  @IsInt()
  @Min(15)
  duration_min: number;

  @ApiPropertyOptional({ example: 'Will bring dog treats.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
