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
  import { Role } from '../../common/enums/role.enum';
  import * as fs from 'fs';
  import { join } from 'path';
  
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
        console.log(`Applying filter: productId=${filters.productId}`);
      }
      if (filters.variantId) {
        where.variantId = filters.variantId as string;
        console.log(`Applying filter: variantId=${filters.variantId}`);
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
      productId?: string,
      variantId?: string,
    ): Promise<ProductImage> {
  
      if ((!productId && !variantId) || (productId && variantId)) {
        // Clean up uploaded file if validation fails early
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting orphaned file:', file.path, err);
        });
        throw new BadRequestException(
          'Image must be associated with either a productId or a variantId, but not both.',
        );
      }
  
      // TODO: Add validation to ensure the product/variant exists and belongs to the client (unless SuperAdmin)
  
      const relativePath = file.path.replace(process.cwd(), '').replace(/\\/g, '/'); // Store relative path
  
      const imageData: Partial<ProductImage> = {
        filename: file.filename,
        path: relativePath.startsWith('/') ? relativePath : `/${relativePath}`, // Ensure leading slash
        originalFilename: file.originalname,
        mimetype: file.mimetype,
        altText,
        isPrimary,
        productId,
        variantId,
      };
  
      // If setting as primary, unset other primary images for the same product/variant
      if (isPrimary) {
        await this.unsetOtherPrimaryImages(productId ?? '', variantId ?? '');
      }
  
      const newImage = this.imageRepository.create(imageData);
      try {
        return await this.imageRepository.save(newImage);
      } catch (error) {
        // Clean up uploaded file if database save fails
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