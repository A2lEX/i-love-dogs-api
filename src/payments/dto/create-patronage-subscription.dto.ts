import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatronageSubscriptionDto {
  @ApiProperty({ example: 1000, description: 'Amount in RUB per month' })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ example: 'uuid-dog-id' })
  @IsUUID()
  @IsNotEmpty()
  dog_id: string;

  @ApiProperty({ example: 'regular', enum: ['regular', 'exclusive'] })
  @IsIn(['regular', 'exclusive'])
  type: 'regular' | 'exclusive';
}
