import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePatronageStatusDto {
  @ApiProperty({
    example: 'cancelled',
    enum: ['active', 'paused', 'cancelled'],
  })
  @IsIn(['active', 'paused', 'cancelled'])
  status: 'active' | 'paused' | 'cancelled';
}
