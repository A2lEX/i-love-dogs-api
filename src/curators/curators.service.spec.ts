import { Test, TestingModule } from '@nestjs/testing';
import { CuratorsService } from './curators.service';

describe('CuratorsService', () => {
  let service: CuratorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CuratorsService],
    }).useMocker(() => ({})).compile();

    service = module.get<CuratorsService>(CuratorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
