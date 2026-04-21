import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  Min,
  IsUUID,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGoalDto {
  @ApiProperty({ example: '123e4567-e89b-12d3... (Dog UUID)' })
  @IsUUID()
  @IsNotEmpty()
  dog_id: string;

  @ApiProperty({
    example: 'medical',
    enum: ['medical', 'sterilization', 'food', 'custom'],
  })
  @IsIn(['medical', 'sterilization', 'food', 'custom'])
  category: 'medical' | 'sterilization' | 'food' | 'custom';

  @ApiProperty({ example: 'Operation for Rex' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'He needs a surgery.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 50000, description: 'Target amount in rub' })
  @IsInt()
  @Min(100)
  amount_target: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;
}
