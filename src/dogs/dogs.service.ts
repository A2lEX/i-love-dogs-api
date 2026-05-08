import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CitiesService } from '../cities/cities.service';
import { CreateDogDto } from './dto/create-dog.dto';
import { UpdateDogDto } from './dto/update-dog.dto';
import { DogFilterDto } from './dto/dog-filter.dto';

@Injectable()
export class DogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly citiesService: CitiesService,
  ) {}

  private async getCuratorProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.curatorProfile.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });
    if (!profile) {
      throw new ForbiddenException('User does not have a curator profile');
    }
    return profile.id;
  }

  private async getOrCreateCityId(cityName: string, lat?: number, lng?: number): Promise<string | null> {
    if (!cityName) return null;
    
    // First, try to find an exact match
    let city = await this.prisma.city.findFirst({
      where: { name: cityName },
    });

    // If not found, and we have lat/lng, create it
    if (!city && lat !== undefined && lng !== undefined) {
      // Need a default country. For now, assume ME if creating new
      const meCountry = await this.prisma.country.findUnique({ where: { code: 'ME' } });
      if (meCountry) {
        city = await this.prisma.city.create({
          data: {
            name: cityName,
            lat,
            lng,
            country_id: meCountry.id,
          },
        });
      }
    }
    
    return city?.id || null;
  }

  async create(userId: string, data: CreateDogDto) {
    const curatorId = await this.getCuratorProfileId(userId);
    const cityId = await this.getOrCreateCityId(data.city, data.city_lat, data.city_lng);

    return this.prisma.dog.create({
      data: {
        curator_id: curatorId,
        name: data.name,
        breed: data.breed || null,
        age_months: data.age_months || null,
        gender: data.gender,
        description: data.description,
        city_id: cityId,
        cover_photo_url: data.cover_photo_url || null,
        photos: data.photos || [],
        status: 'active',
      },
    });
  }

  async update(userId: string, dogId: string, data: UpdateDogDto) {
    const curatorId = await this.getCuratorProfileId(userId);

    const dog = await this.prisma.dog.findUnique({
      where: { id: dogId },
      select: { curator_id: true },
    });

    if (!dog) {
      throw new NotFoundException('Dog not found');
    }
    if (dog.curator_id !== curatorId) {
      throw new ForbiddenException('You can only edit your own dogs');
    }

    let cityId: string | undefined;
    if (data.city) {
      const resolvedCityId = await this.getOrCreateCityId(data.city, data.city_lat, data.city_lng);
      if (resolvedCityId) cityId = resolvedCityId;
    }

    return this.prisma.dog.update({
      where: { id: dogId },
      data: {
        name: data.name,
        breed: data.breed,
        age_months: data.age_months,
        gender: data.gender,
        description: data.description,
        ...(cityId ? { city_id: cityId } : {}),
        cover_photo_url: data.cover_photo_url,
        photos: data.photos,
        status: data.status,
      },
    });
  }

  async findAll(filter: DogFilterDto) {
    const where: any = {
      status: 'active',
    };

    if (filter.gender) where.gender = filter.gender;
    if (filter.breed)
      where.breed = { contains: filter.breed, mode: 'insensitive' };

    // City relation filtering
    if (filter.city || filter.country) {
      where.city = {};
      if (filter.city) {
        where.city.name = { contains: filter.city, mode: 'insensitive' };
      }
      if (filter.country) {
        where.city.country = { code: filter.country.toUpperCase() };
      }
    }

    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const [items, total] = await Promise.all([
      this.prisma.dog.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          curator: {
            select: { shelter_name: true, city: true },
          },
          city: true,
        },
      }),
      this.prisma.dog.count({ where }),
    ]);

    // Format output to match existing frontend expectations
    const formattedItems = items.map(item => ({
      ...item,
      city: item.city?.name || 'Unknown',
      city_lat: item.city?.lat,
      city_lng: item.city?.lng,
    }));

    return {
      items: formattedItems,
      total,
      limit,
      offset,
    };
  }

  async findById(id: string) {
    const dog = await this.prisma.dog.findUnique({
      where: { id },
      include: {
        curator: {
          select: {
            id: true,
            shelter_name: true,
            city: true,
            description: true,
            payment_methods: {
              where: { is_active: true },
              orderBy: { sort_order: 'asc' },
              select: {
                id: true,
                type: true,
                label: true,
                value: true,
              },
            },
          },
        },
        city: true,
        goals: {
          where: { status: 'active' },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!dog) {
      throw new NotFoundException('Dog not found');
    }

    return {
      ...dog,
      city: dog.city?.name || 'Unknown',
      city_lat: dog.city?.lat,
      city_lng: dog.city?.lng,
    };
  }
}
