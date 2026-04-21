import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  bucket: process.env.S3_BUCKET || 'dogcare',
  accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
  region: process.env.S3_REGION || 'ru-central1',
  publicUrl: process.env.S3_PUBLIC_URL,
  signingEndpoint: process.env.S3_PUBLIC_ENDPOINT,
}));
