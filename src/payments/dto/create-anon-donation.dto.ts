import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAnonDonationDto {
  @ApiProperty({ example: 500, description: 'Amount in RUB' })
  @IsNumber()
  @Min(10)
  amount: number;

  @ApiProperty({ example: 'uuid-goal-id' })
  @IsUUID()
  @IsNotEmpty()
  goal_id: string;

  @ApiProperty({ example: 'donor@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Anonymous Donor' })
  @IsOptional()
  @IsString()
  display_name?: string;
}
