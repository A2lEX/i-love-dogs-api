import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  private readonly redisClient: Redis;
  private readonly refreshExpiresInDays: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.redisClient = new Redis(
      this.configService.get<string>('redis.url') || 'redis://localhost:6379',
    );
    // e.g. "30d" -> 30
    const expiresStr =
      this.configService.get<string>('jwt.refreshExpires') || '30d';
    this.refreshExpiresInDays = parseInt(expiresStr.replace('d', ''), 10) || 30;
  }

  async generateAccessTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    // JWT
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: (this.configService.get<string>('jwt.accessExpires') ||
        '15m') as any,
    });

    // Opaque Refresh Token
    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Store in Redis: key = refreshToken, value = userId, TTL = 30 days in seconds
    const ttlSeconds = this.refreshExpiresInDays * 24 * 60 * 60;
    await this.redisClient.setex(
      `refresh_token:${refreshToken}`,
      ttlSeconds,
      userId,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async validateRefreshToken(token: string): Promise<string> {
    const userId = await this.redisClient.get(`refresh_token:${token}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return userId;
  }

  async removeRefreshToken(token: string): Promise<void> {
    await this.redisClient.del(`refresh_token:${token}`);
  }

  async removeAllRefreshTokensForUser(userId: string): Promise<void> {
    // Basic lookup to delete all tokens for a user would require maintaining a set of tokens per user.
    // To simplify for this stage, we assume logout invalidates only the specific token provided.
  }
}
