import { PartialType } from '@nestjs/swagger';
import { CreateDogDto } from './create-dog.dto';
import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDogDto extends PartialType(CreateDogDto) {
  @ApiPropertyOptional({
    example: 'adopted',
    enum: ['active', 'on_hold', 'medical', 'adopted', 'deceased', 'archived'],
  })
  @IsOptional()
  @IsIn(['active', 'on_hold', 'medical', 'adopted', 'deceased', 'archived'])
  status?:
    | 'active'
    | 'on_hold'
    | 'medical'
    | 'adopted'
    | 'deceased'
    | 'archived';
}
