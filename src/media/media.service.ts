import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class MediaService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('s3.bucket') || 'dogcare';

    this.s3Client = new S3Client({
      region: this.configService.get<string>('s3.region') || 'ru-central1',
      endpoint: this.configService.get<string>('s3.endpoint'),
      credentials: {
        accessKeyId: this.configService.get<string>('s3.accessKey') || '',
        secretAccessKey: this.configService.get<string>('s3.secretKey') || '',
      },
      forcePathStyle: true, // Needed for MinIO locally
    });
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
      // Setting roughly 10MB limit in S3 natively is generally done via conditions in Pre-Signed POST,
      // but for generating signed URL via GET/PUT you can enforce on client or use Cloudflare limit.
      // Pre-Signed POST is better for strict size limits but PutObject signed URL is simpler.
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 300,
    }); // 5 minutes

    const fileUrl = `${this.configService.get<string>('s3.endpoint')}/${this.bucket}/${key}`;

    return {
      upload_url: uploadUrl,
      file_url: fileUrl,
      key,
    };
  }
}
