import {
    Controller,
    Post,
    Param,
    UploadedFile,
    UseInterceptors,
    UseGuards,
    ParseUUIDPipe,
    Delete,
    HttpCode,
    HttpStatus,
    Body,
    BadRequestException,
    Query,
    ParseBoolPipe,
    Put,
    ValidationPipe,
    Get,
    Res,
    DefaultValuePipe,
    ParseIntPipe,
  } from '@nestjs/common';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { Express } from 'express';
  import { ImagesService } from '../services/images.service';
  import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
  import { RolesGuard } from '../../common/guards/roles.guard';
  import { SimpleRestParams } from '../../common/pipes/parse-simple-rest.pipe'; 
  import { Roles } from '../../common/decorators/roles.decorators';
  import { Role } from '../../common/enums/role.enum';
  import { UpdateImageDetailsDto } from '../dto/update/update-image-details.dto'; 
  
  @Controller('images') 
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin) 
  export class ImagesController {
    constructor(private readonly imagesService: ImagesService) {}
    

    @Get()
    @Roles(Role.Admin, Role.SuperAdmin) 
    async findAll(
      @Query('filter') filterString: string = '{}',
      @Query('range') rangeString: string = '[0,9]',
      @Query('sort') sortString: string = '["id","ASC"]',
      @Res({ passthrough: true }) res: import('express').Response
  ): Promise<any> { 

    const filter = JSON.parse(filterString);
    const rangeArray = JSON.parse(rangeString);
    const range: [number, number] = Array.isArray(rangeArray) && rangeArray.length === 2 
      ? [Number(rangeArray[0]), Number(rangeArray[1])] 
      : (() => { throw new BadRequestException('Invalid range parameter. Expected [start, end].'); })();
    const sort = JSON.parse(sortString);


    if (!Array.isArray(range) || range.length !== 2) {
        throw new BadRequestException('Invalid range parameter. Expected [start, end].');
    }
     if (!Array.isArray(sort) || sort.length !== 2) {
        throw new BadRequestException('Invalid sort parameter. Expected [field, order].');
    }

    const params: SimpleRestParams = { 
      filters: filter, 
      range, 
      sort: `${sort[0]}:${sort[1]}` // Convert sort array to string
    };
    const { data, total } = await this.imagesService.findPaginated(params);

   
    const [start, end] = range;
    const contentRange = `images ${start}-${start + data.length - 1}/${total}`;
    res.setHeader('Content-Range', contentRange);
    

    return data; 
  }

  @Get(':imageId')
  async findOne(@Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.imagesService.findOneImage(imageId);
  }

    
  @Post('product/:productId')
  @UseInterceptors(FileInterceptor('image')) 
  async uploadProductImage(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('altText') altText?: string,
    @Body('isPrimary', new ParseBoolPipe({ optional: true })) isPrimary: boolean = false,
    @Body('displayOrder', new DefaultValuePipe(0), ParseIntPipe) displayOrder: number = 0,
    @Body('clientId', ParseUUIDPipe) clientId?: string, 
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }
    console.log('Uploading image for product:', productId);
    console.log('File:', file);
    return this.imagesService.createImageRecord(
      file,
      altText,
      isPrimary,
      displayOrder,
      productId,
      undefined, 
      clientId, 
    );
  }
  
  
    @Post('variant/:variantId')
    @UseInterceptors(FileInterceptor('image'))
    async uploadVariantImage(
      @Param('variantId', ParseUUIDPipe) variantId: string,
      @UploadedFile() file: Express.Multer.File,
      @Body('altText') altText?: string,
      @Body('isPrimary', new ParseBoolPipe({ optional: true })) isPrimary: boolean = false,
      @Body('displayOrder', new DefaultValuePipe(0), ParseIntPipe) displayOrder: number = 0,
      @Body('clientId', ParseUUIDPipe) clientId?: string,
    ) {
      if (!file) {
        throw new BadRequestException('Image file is required.');
      }
      return this.imagesService.createImageRecord(
        file,
        altText,
        isPrimary,
        displayOrder,
        undefined, 
        variantId,
        clientId
      );
    }

    @Put(':imageId')
    async updateDetails(
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) updateDto: UpdateImageDetailsDto,
  ) {
    if (Object.keys(updateDto).length === 0) {
        throw new BadRequestException('No update data provided.');
    }
    return this.imagesService.updateImageDetails(imageId, updateDto);
  }
  
    
    @Delete(':imageId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteImage(@Param('imageId', ParseUUIDPipe) imageId: string): Promise<void> {
      return this.imagesService.deleteImage(imageId);
    }
  
  }