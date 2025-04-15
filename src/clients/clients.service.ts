import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe'; // Adjust path if needed

@Injectable()
export class ClientsService {
  constructor(

    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async create(createClientDto: CreateClientDto): Promise<Client> {
    const client = this.clientRepository.create(createClientDto);
    return this.clientRepository.save(client);
  }

  async findAll(): Promise<Client[]> {
    
    return this.clientRepository.find();
  }

  async findAllSimpleRest(
    params: SimpleRestParams,
  ): Promise<{ data: Client[]; totalCount: number }> {
    const { start = 0, end = 9, sort = 'name', order = 'ASC', filters = {} } = params;
    const take = end - start + 1;
    const skip = start;

    const qb = this.clientRepository.createQueryBuilder('client');

   
    for (const key in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, key) && filters[key] !== undefined && filters[key] !== null) {
        if (this.clientRepository.metadata.hasColumnWithPropertyPath(key)) {
           qb.andWhere(`client.${key} ILIKE :${key}Value`, { [`${key}Value`]: `%${filters[key]}%` });
        } else {
           console.warn(`Ignoring invalid filter field for clients: ${key}`);
        }
      }
    }

    
    if (this.clientRepository.metadata.hasColumnWithPropertyPath(sort)) {
      qb.orderBy(`client.${sort}`, order as 'ASC' | 'DESC');
    } else {
      qb.orderBy('client.name', 'ASC'); // Default sort
    }

    qb.skip(skip).take(take);

    const [data, totalCount] = await qb.getManyAndCount();
    return { data, totalCount };
  }


  async findOne(id: string): Promise<Client> {
    const client = await this.clientRepository.findOne({
        where: { id },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID "${id}" not found`);
    }
    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto): Promise<Client> {
  
    const client = await this.findOne(id);

    this.clientRepository.merge(client, updateClientDto);

   
    return this.clientRepository.save(client);
  }

  async remove(id: string): Promise<void> {
    const result = await this.clientRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Client with ID "${id}" not found`);
    }
  }
}