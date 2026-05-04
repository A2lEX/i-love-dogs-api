import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCountry(countryCode: string) {
    return this.prisma.city.findMany({
      where: { country_code: countryCode.toUpperCase() },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, country_code: true },
    });
  }

  async getCityNamesByCountry(countryCode: string): Promise<string[]> {
    const cities = await this.prisma.city.findMany({
      where: { country_code: countryCode.toUpperCase() },
      select: { name: true },
    });
    return cities.map((c) => c.name);
  }
}
