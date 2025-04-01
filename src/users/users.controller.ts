import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  Query, 
  UsePipes, 
  ValidationPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { Role } from '../common/enums/role.enum';
import { User } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.Admin)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  async findAll(
    @Query('filter') filterString: string = '{}',
    @Query('range') rangeString: string = '[0,9]',
    @Query('sort') sortString: string = '["id","ASC"]',
    @Res({ passthrough: true }) res: Response,
  ): Promise<User[]> {
    try {
      // Parse the query parameters
      const filter = JSON.parse(filterString);
      const range = JSON.parse(rangeString);
      const sort = JSON.parse(sortString);

      // Extract values
      const [start, end] = range;
      const [sortField, sortOrder] = sort;

      // Call service with extracted parameters
      const { data, totalCount } = await this.usersService.findAllSimpleRest({
        start,
        end,
        sort: sortField,
        order: sortOrder,
        filters: filter,
      });

      // Set Content-Range header in the format React Admin expects
      res.header(
        'Content-Range', 
        `users ${start}-${Math.min(end, totalCount - 1)}/${totalCount}`
      );
      
      // Make sure header is exposed via CORS
      res.header('Access-Control-Expose-Headers', 'Content-Range');

      return data;
    } catch (error) {
      console.error('Error processing request:', error);
      throw error;
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }


  @Patch(':id')
  @Roles(Role.Admin)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}