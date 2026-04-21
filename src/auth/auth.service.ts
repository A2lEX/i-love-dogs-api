import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password_hash: hashedPassword,
      phone: dto.phone,
      role: 'donor',
      status: 'active',
    });

    const tokens = await this.tokenService.generateAccessTokens(
      user.id,
      user.email,
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.status === 'suspended') {
      throw new UnauthorizedException(
        'Invalid credentials or suspended account',
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.tokenService.generateAccessTokens(
      user.id,
      user.email,
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const userId = await this.tokenService.validateRefreshToken(
      dto.refresh_token,
    );
    const user = await this.usersService.findById(userId);
    if (!user || user.status === 'suspended') {
      throw new UnauthorizedException('User no longer valid');
    }

    // Rotate refreshToken
    await this.tokenService.removeRefreshToken(dto.refresh_token);

    return this.tokenService.generateAccessTokens(user.id, user.email);
  }

  async logout(userId: string, dto: RefreshTokenDto) {
    // Optionally verify that the token belongs to the user, but we'll just invalidate it
    await this.tokenService.removeRefreshToken(dto.refresh_token);
  }

  private sanitizeUser(user: any) {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  async getMe(user: any) {
    // user object is already provided by JwtStrategy/Guard
    return this.sanitizeUser(user);
  }
}
