import { Module } from '@nestjs/common';
import { PatronagesController } from './patronages.controller';
import { PatronagesService } from './patronages.service';

@Module({
  controllers: [PatronagesController],
  providers: [PatronagesService],
})
export class PatronagesModule {}
