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
    ValidationPipe
  } from '@nestjs/common';
  import { ClientsService } from './clients.service';
  import { CreateClientDto } from './dto/create-client.dto';
  import { UpdateClientDto } from './dto/update-client.dto';
  import { AuthGuard } from '@nestjs/passport'; 
  import { RolesGuard } from '../common/guards/roles.guard'; 
  import { Roles } from '../common/decorators/roles.decorators'; 
  import { Role } from '../common/enums/role.enum'; 
  import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe';
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
      @Query(new ValidationPipe({ transform: true, whitelist: true })) params: SimpleRestParams,
      @Res({ passthrough: true }) res: Response, 
    ) {
      const { data, totalCount } = await this.clientsService.findAllSimpleRest(params);
      const start = params.start ?? 0;
      const end = data.length > 0 ? start + data.length - 1 : start;
      res.set('Content-Range', `clients ${start}-${end}/${totalCount}`);
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