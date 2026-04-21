import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCuratorProfileDto {
  @ApiProperty({ example: 'Happy Tails Shelter' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  shelter_name: string;

  @ApiPropertyOptional({ example: 'Lenina 1, Moscow' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Moscow' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ example: 'We save dogs in Moscow region.' })
  @IsOptional()
  @IsString()
  description?: string;
}
