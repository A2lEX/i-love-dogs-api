import { Test, TestingModule } from '@nestjs/testing';
import { PatronagesController } from './patronages.controller';

describe('PatronagesController', () => {
  let controller: PatronagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatronagesController],
    }).useMocker(() => ({})).compile();

    controller = module.get<PatronagesController>(PatronagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
