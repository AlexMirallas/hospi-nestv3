import {
    Injectable,
    NotFoundException,
    InternalServerErrorException,
    ForbiddenException,
    BadRequestException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository, FindOptionsOrder, FindOptionsWhere } from 'typeorm';
  import { ProductImage } from '../entities/image.entity';
  import { ClsService } from 'nestjs-cls';
  import * as fs from 'fs';
  import { join } from 'path';
  import { UpdateImageDetailsDto } from '../dto/update/update-image-details.dto';
  import { Role } from '../../common/enums/role.enum';
  import { SimpleRestParams } from '../../common/pipes/parse-simple-rest.pipe'
  
  @Injectable()
  export class ImagesService {

    constructor(
      @InjectRepository(ProductImage)
      private readonly imageRepository: Repository<ProductImage>,
      private readonly cls: ClsService,
    ) {}
    
    async findPaginated(
      params: SimpleRestParams,
    ): Promise<{ data: ProductImage[]; total: number }> {
      const { range = [0, 9], sort = ['displayOrder', 'ASC'], filters = {} } = params;
      const [start, end] = range;
      const [sortField, sortOrder] = sort;
  
      const take = end - start + 1;
      const skip = start;
  
      // Where clause only contains application-specific filters
      const where: FindOptionsWhere<ProductImage> = {};
  
      // Apply Filters (productId, variantId, potentially clientId for SuperAdmin)
      // The repository's findAndCount method will handle tenant filtering
      if (filters.clientId) {
          where.clientId = filters.clientId as string;
      }
      if (filters.productId) {
        where.productId = filters.productId as string;
      }
      if (filters.variantId) {
        where.variantId = filters.variantId as string;
      }
  
      // Define Sorting
      const order: FindOptionsOrder<ProductImage> = {};
      const validSortFields = ['id', 'filename', 'displayOrder', 'createdAt', 'updatedAt', 'altText', 'isPrimary'];
       if (validSortFields.includes(sortField)) {
          order[sortField as keyof ProductImage] = sortOrder as 'ASC' | 'DESC';
      } else {
          order.displayOrder = 'ASC'; // Default sort
      }
      // Fetch Data using the tenant-aware repository method
   try {
        const [data, total] = await this.imageRepository.findAndCount({
          where,
          order,
          take,
          skip,
        });
        return { data, total };
      } catch (error) {
        if (error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
            throw error;
        }
        throw new InternalServerErrorException('Failed to fetch images.');
      }
    }

  
    async createImageRecord(
      file: Express.Multer.File,
      altText: string | undefined,
      isPrimary: boolean,
      displayOrder: number,
      productId?: string,
      variantId?: string,
      clientId?: string,
    ): Promise<ProductImage> {
  
      if ((!productId && !variantId) || (productId && variantId)) {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting orphaned file:', file.path, err);
        });
        throw new BadRequestException(
          'Image must be associated with either a productId or a variantId, but not both.',
        );
      }
  
      const currentUserClientId = this.cls.get('clientId');
      const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
      const isSuperAdmin = currentUserRoles?.includes(Role.SuperAdmin);

      let targetClientId:string | undefined;

      if( isSuperAdmin) {
        if (!clientId) {
          console.error('SuperAdmin uploading image without clientId');
          throw new BadRequestException('SuperAdmin must provide clientId when uploading images.');
        }
        targetClientId = clientId;
      } else {
        if (currentUserClientId) {
          targetClientId = currentUserClientId;
          if (!targetClientId) {
          fs.unlink(file.path, (err) => { 
            if (err) console.error('Error deleting file for missing clientId:', file.path, err);
           });
          throw new InternalServerErrorException('User client context not found.');
        }
      }
    }
  
      const relativePath = file.path.replace(process.cwd(), '').replace(/\\/g, '/'); // Store relative path
  
      const imageData: Partial<ProductImage> = {
        filename: file.filename,
        path: relativePath.startsWith('/') ? relativePath : `/${relativePath}`, 
        originalFilename: file.originalname,
        mimetype: file.mimetype,
        altText,
        clientId: targetClientId,
        isPrimary,
        displayOrder: displayOrder ?? 0,
        productId,
        variantId,
      };

      console.log('Creating image record:', imageData);
  
      
      if (isPrimary) {
        await this.unsetOtherPrimaryImages(productId ?? '', variantId ?? '');
      }
  
      const newImage = this.imageRepository.create(imageData);
      try {
        return await this.imageRepository.save(newImage);
      } catch (error) {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file after DB error:', file.path, err);
        });
        throw new InternalServerErrorException('Failed to save image record.', error);
      }
    }
  
    async deleteImage(imageId: string): Promise<void> {
      // Use tenant-aware findOneByOrFail (or findOneBy and check)
      const image = await this.imageRepository.findOneByOrFail({ id: imageId });
  
      const fullPath = join(process.cwd(), image.path);
      try {
         if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`File deleted: ${fullPath}`);
        } else {
          console.log(`File not found: ${fullPath}`);
        }
      } catch (error) {
        console.error('Error deleting file:', fullPath, error);
        throw new InternalServerErrorException('Failed to delete image file from server.');
      }
  
      try {
          // Use the repository's remove method
          await this.imageRepository.remove(image);
         
      } catch(error) {
  
           if (error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
               throw error;
           }
           throw new InternalServerErrorException('Failed to delete image record from database.');
      }
    }
  
    

    async findOneImage(imageId: string): Promise<ProductImage> {
      try {
        // Use tenant-aware findOneByOrFail
        const image = await this.imageRepository.findOneByOrFail({ id: imageId });
        return image;
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        if (error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
          throw error; // Re-throw specific errors from repository/context
        }
        // Generic error if something else went wrong
        throw new InternalServerErrorException(`Failed to retrieve image ${imageId}.`);
      }
    }

    async updateImageDetails(
      imageId: string,
      updateDto: UpdateImageDetailsDto,
    ): Promise<ProductImage> {
      console.log(`Updating image details for ID: ${imageId} with data: ${JSON.stringify(updateDto)}`);
  
      // Fetch the image using tenant-aware method to ensure ownership/existence
      const image = await this.findOneImage(imageId); // Reuse findOneImage for consistency
  
      // Check if setting as primary
      if (updateDto.isPrimary === true && !image.isPrimary) {
        console.log(`Setting image ${imageId} as primary. Unsetting others for product=${image.productId}, variant=${image.variantId}`);
        // Ensure productId/variantId are available on the fetched image entity
        if (!image.productId && !image.variantId) {
          console.error(`Image ${imageId} is missing product/variant association, cannot unset primary.`);
          // Handle this case appropriately - maybe throw an error or just log
        } else {
           await this.unsetOtherPrimaryImages(image.productId, image.variantId);
        }
      }
      if (updateDto.altText !== undefined) {
        image.altText = updateDto.altText;
    }
    if (updateDto.displayOrder !== undefined) {
        image.displayOrder = updateDto.displayOrder;
    }
     if (updateDto.isPrimary !== undefined) {
        image.isPrimary = updateDto.isPrimary;
    }
    try {
      // Save the updated entity using tenant-aware save
      const updatedImage = await this.imageRepository.save(image);
      console.log(`Successfully updated image ${imageId}`);
      return updatedImage;
    } catch (error) {
      console.error(`Failed to save updated image details for ${imageId}: ${error.message}`, error.stack);
       if (error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
        throw error; // Re-throw specific errors from repository/context
      }
      throw new InternalServerErrorException(`Failed to update image details for ${imageId}.`);
    }
  }

  private async unsetOtherPrimaryImages(
    productId?: string,
    variantId?: string,
  ): Promise<void> {
    // Where clause doesn't need clientId manually added
    const whereCondition: FindOptionsWhere<ProductImage> = { isPrimary: true };
    if (productId) {
      whereCondition.productId = productId;
    } else if (variantId) {
      whereCondition.variantId = variantId;
    } else {
      return;
    }

    try {
        // Use the repository's update method
        const result = await this.imageRepository.update(whereCondition, { isPrimary: false });
    } catch (error) {
         if (error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
             throw error;
         }
    }
  }
}