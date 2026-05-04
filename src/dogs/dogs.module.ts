import { Module } from '@nestjs/common';
import { DogsController } from './dogs.controller';
import { DogsService } from './dogs.service';
import { CitiesModule } from '../cities/cities.module';

@Module({
  imports: [CitiesModule],
  controllers: [DogsController],
  providers: [DogsService],
})
export class DogsModule {}
