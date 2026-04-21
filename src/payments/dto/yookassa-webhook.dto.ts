import { IsNotEmpty, IsString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class YookassaWebhookDto {
  @ApiProperty({ example: 'payment.succeeded' })
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiProperty({ example: 'transaction_id_123' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Payment object payload' })
  @IsObject()
  @IsNotEmpty()
  object: any;
}
