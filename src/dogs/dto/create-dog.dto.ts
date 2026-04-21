import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsUrl,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDogDto {
  @ApiProperty({ example: 'Rex' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'German Shepherd' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  breed?: string;

  @ApiPropertyOptional({ example: 24, description: 'Age in months' })
  @IsOptional()
  @IsInt()
  age_months?: number;

  @ApiProperty({ example: 'male', enum: ['male', 'female', 'unknown'] })
  @IsIn(['male', 'female', 'unknown'])
  gender: 'male' | 'female' | 'unknown';

  @ApiProperty({ example: 'Friendly and active dog.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Moscow' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ example: 'https://minio.local/dogcare/rex.jpg' })
  @IsOptional()
  @IsUrl()
  cover_photo_url?: string;

  @ApiPropertyOptional({
    example: ['https://minio.local/dogcare/rex-1.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
