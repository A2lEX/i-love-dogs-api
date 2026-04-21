import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWalkStatusDto {
  @ApiProperty({
    example: 'confirmed',
    enum: ['pending', 'confirmed', 'started', 'completed', 'cancelled'],
  })
  @IsIn(['pending', 'confirmed', 'started', 'completed', 'cancelled'])
  status: 'pending' | 'confirmed' | 'started' | 'completed' | 'cancelled';
}
