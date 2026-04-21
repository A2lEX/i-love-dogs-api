import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGoalStatusDto {
  @ApiProperty({
    example: 'completed',
    enum: ['active', 'completed', 'cancelled'],
  })
  @IsIn(['active', 'completed', 'cancelled'])
  status: 'active' | 'completed' | 'cancelled';
}
