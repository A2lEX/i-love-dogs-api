import { Test, TestingModule } from '@nestjs/testing';
import { WalksService } from './walks.service';

describe('WalksService', () => {
  let service: WalksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalksService],
    }).useMocker(() => ({})).compile();

    service = module.get<WalksService>(WalksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
