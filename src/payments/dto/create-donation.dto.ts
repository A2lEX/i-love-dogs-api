import { IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDonationDto {
  @ApiProperty({ example: 500, description: 'Amount in RUB' })
  @IsNumber()
  @Min(10)
  amount: number;

  @ApiPropertyOptional({
    example: 'uuid-goal-id',
    description: 'Goal ID if donating to a specific goal',
  })
  @IsOptional()
  @IsUUID()
  goal_id?: string;
}
