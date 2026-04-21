import { Test, TestingModule } from '@nestjs/testing';
import { WalksController } from './walks.controller';

describe('WalksController', () => {
  let controller: WalksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalksController],
    }).useMocker(() => ({})).compile();

    controller = module.get<WalksController>(WalksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
