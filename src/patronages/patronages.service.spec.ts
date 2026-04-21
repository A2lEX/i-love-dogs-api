import { Test, TestingModule } from '@nestjs/testing';
import { PatronagesService } from './patronages.service';

describe('PatronagesService', () => {
  let service: PatronagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PatronagesService],
    }).useMocker(() => ({})).compile();

    service = module.get<PatronagesService>(PatronagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
