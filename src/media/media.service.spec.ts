import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('MediaService', () => {
  let service: MediaService;
  let configService: ConfigService;

  const mockConfig: Record<string, string | undefined> = {
    's3.endpoint': 'http://internal-minio:9000',
    's3.bucket': 'dogcare',
    's3.region': 'ru-central1',
    's3.accessKey': 'key',
    's3.secretKey': 'secret',
    's3.signingEndpoint': undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  it('should use internal endpoint for signing by default', async () => {
    mockConfig['s3.signingEndpoint'] = undefined;
    // Instantiate again to reflect config
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();
    service = module.get<MediaService>(MediaService);

    await service.generatePresignedUrl('test.jpg', 'image/jpeg');

    expect(S3Client).toHaveBeenCalledTimes(1);
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://internal-minio:9000',
      }),
    );
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('should use signingEndpoint for signing if provided', async () => {
    mockConfig['s3.signingEndpoint'] = 'https://public-minio.com';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();
    service = module.get<MediaService>(MediaService);

    await service.generatePresignedUrl('test.jpg', 'image/jpeg');

    // Should have two clients: one for internal ops, one for signing
    expect(S3Client).toHaveBeenCalledTimes(2);
    expect(S3Client).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        endpoint: 'http://internal-minio:9000',
      }),
    );
    expect(S3Client).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        endpoint: 'https://public-minio.com',
      }),
    );

    // getSignedUrl should use the second client (signing client)
    const signingClient = (S3Client as unknown as jest.Mock).mock.instances[1];
    expect(getSignedUrl).toHaveBeenCalledWith(
      signingClient,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('should generate correct file_url using signingEndpoint if publicUrl is not provided', async () => {
    mockConfig['s3.signingEndpoint'] = 'https://public-minio.com';
    mockConfig['s3.publicUrl'] = undefined;
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();
    service = module.get<MediaService>(MediaService);

    const result = await service.generatePresignedUrl('test.jpg', 'image/jpeg');

    expect(result.file_url).toContain('https://public-minio.com/dogcare/uploads/');
  });
});
