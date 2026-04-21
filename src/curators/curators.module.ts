import { Module } from '@nestjs/common';
import { CuratorsController } from './curators.controller';
import { CuratorsService } from './curators.service';

@Module({
  controllers: [CuratorsController],
  providers: [CuratorsService],
})
export class CuratorsModule {}
