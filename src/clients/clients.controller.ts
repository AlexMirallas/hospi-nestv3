import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    ParseUUIDPipe,
    UseGuards,
    Query,
    Res,
    HttpCode,
    HttpStatus,
    Put,
  } from '@nestjs/common';
  import { ClientsService } from './clients.service';
  import { CreateClientDto } from './dto/create-client.dto';
  import { UpdateClientDto } from './dto/update-client.dto';
  import { AuthGuard } from '@nestjs/passport'; 
  import { RolesGuard } from '../common/guards/roles.guard'; 
  import { Roles } from '../common/decorators/roles.decorators'; 
  import { Role } from '../common/enums/role.enum'; 
  import { Response } from 'express';
  
  @Controller('clients')
  @UseGuards(AuthGuard('jwt'), RolesGuard) 
  @Roles(Role.SuperAdmin) 
  export class ClientsController {
    constructor(private readonly clientsService: ClientsService) {}
  
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createClientDto: CreateClientDto) {
      return this.clientsService.create(createClientDto);
    }
  
    @Get()
    async findAll(
      @Query('filter') filterString: string = '{}',
      @Query('range') rangeString: string = '[0,9]',
      @Query('sort') sortString: string = '["id","ASC"]',
      @Res({ passthrough: true }) res: Response, 
    ) {
      const filter = JSON.parse(filterString);
      const range = JSON.parse(rangeString);
      const sort = JSON.parse(sortString);

      const [start, end] = range;
      const [sortField, sortOrder] = sort;

      const { data, totalCount } = await this.clientsService.findAllSimpleRest({
        start,
        end,
        sort: sortField,
        order: sortOrder,
        filters: filter,
      });

      res.header('Content-Range', `clients ${start}-${Math.min(end, totalCount - 1)}/${totalCount}`);
      res.header('Access-Control-Expose-Headers', 'Content-Range');
      return data; 
    }
  
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.clientsService.findOne(id);
    }
  
    @Put(':id')
    update(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() updateClientDto: UpdateClientDto,
    ) {
      return this.clientsService.update(id, updateClientDto);
    }
  
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT) 
    remove(@Param('id', ParseUUIDPipe) id: string) {
      return this.clientsService.remove(id);
    }
  }