import { PartialType } from '@nestjs/swagger';
import { CreateDogDto } from './create-dog.dto';
import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDogDto extends PartialType(CreateDogDto) {
  @ApiPropertyOptional({
    example: 'adopted',
    enum: ['active', 'adopted', 'deceased', 'archived'],
  })
  @IsOptional()
  @IsIn(['active', 'adopted', 'deceased', 'archived'])
  status?: 'active' | 'adopted' | 'deceased' | 'archived';
}
