import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3Client: S3Client;
  private readonly signingS3Client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('s3.bucket') || 'dogcare';

    const baseConfig = {
      region: this.configService.get<string>('s3.region') || 'ru-central1',
      credentials: {
        accessKeyId: this.configService.get<string>('s3.accessKey') || '',
        secretAccessKey: this.configService.get<string>('s3.secretKey') || '',
      },
      forcePathStyle: true,
    };

    // 1. Internal client for server-side operations (using minio:9000)
    this.s3Client = new S3Client({
      ...baseConfig,
      endpoint: this.configService.get<string>('s3.endpoint'),
    });

    // 2. Public client for signing (using the public proxy URL)
    const signingEndpoint = this.configService.get<string>('s3.signingEndpoint');
    this.signingS3Client = signingEndpoint
      ? new S3Client({
          ...baseConfig,
          endpoint: signingEndpoint,
        })
      : this.s3Client;

    this.logger.log(`MediaService initialized with endpoint: ${this.configService.get<string>('s3.endpoint')}`);
    if (signingEndpoint) {
      this.logger.log(`Using signing endpoint: ${signingEndpoint}`);
    }
  }

  async generatePresignedUrl(filename: string, contentType: string) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException('Invalid file type');
    }

    const uuid = crypto.randomUUID();
    const key = `uploads/${uuid}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    // Generate signed URL using the public signing client
    // This ensures the Host header in the signature matches the public endpoint
    const uploadUrl = await getSignedUrl(this.signingS3Client, command, {
      expiresIn: 300,
    });

    const publicUrl = this.configService.get<string>('s3.publicUrl');
    const fileUrl = `${(publicUrl || this.configService.get<string>('s3.endpoint')).replace(/\/$/, '')}/${key}`;

    return {
      upload_url: uploadUrl,
      file_url: fileUrl,
      key,
    };
  }
}
