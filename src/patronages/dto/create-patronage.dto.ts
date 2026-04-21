import { IsNotEmpty, IsIn, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatronageDto {
  @ApiProperty({ example: 'uuid-dog-id' })
  @IsUUID()
  @IsNotEmpty()
  dog_id: string;

  @ApiProperty({ example: 'regular', enum: ['regular', 'exclusive'] })
  @IsIn(['regular', 'exclusive'])
  type: 'regular' | 'exclusive';
}
