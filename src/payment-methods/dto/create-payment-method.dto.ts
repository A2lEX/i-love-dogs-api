import { IsString, IsOptional, IsInt, MaxLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const PAYMENT_METHOD_TYPES = [
  'paypal',
  'iban',
  'revolut',
  'wise',
  'crypto',
  'other',
] as const;

export class CreatePaymentMethodDto {
  @ApiProperty({ enum: PAYMENT_METHOD_TYPES, example: 'paypal' })
  @IsString()
  @IsIn(PAYMENT_METHOD_TYPES)
  type: string;

  @ApiProperty({ example: 'PayPal EUR' })
  @IsString()
  @MaxLength(100)
  label: string;

  @ApiProperty({ example: 'shelter@example.com' })
  @IsString()
  @MaxLength(500)
  value: string;

  @ApiProperty({ required: false, example: 0 })
  @IsOptional()
  @IsInt()
  sort_order?: number;
}
