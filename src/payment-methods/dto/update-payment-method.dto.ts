import { IsString, IsOptional, IsInt, IsBoolean, MaxLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PAYMENT_METHOD_TYPES } from './create-payment-method.dto';

export class UpdatePaymentMethodDto {
  @ApiProperty({ enum: PAYMENT_METHOD_TYPES, required: false })
  @IsOptional()
  @IsString()
  @IsIn(PAYMENT_METHOD_TYPES)
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  value?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sort_order?: number;
}
