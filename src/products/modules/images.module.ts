import { Module, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { ProductImage } from '../entities/image.entity';
import { ImagesService } from '../services/images.service';
import { ImagesController } from '../controllers/images.controller';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ImageRepository } from '../repositories/image.repository';
import { Role } from 'src/common/enums/role.enum';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'products');


if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductImage]),
    ClsModule, 
    MulterModule.registerAsync({
      imports: [ClsModule], 
      useFactory: (cls: ClsService) => ({
        storage: diskStorage({
          destination: (req, file, cb) => {
            const userRoles = cls.get('userRoles') || [];
            let clientId: string;
            if( userRoles.includes(Role.SuperAdmin)){
              clientId = 'shared';
            }else{
              clientId = cls.get('clientId') || 'default';
            }
             
            const clientDir = join(UPLOAD_DIR, clientId);

            
            if (!fs.existsSync(clientDir)) {
              fs.mkdirSync(clientDir, { recursive: true });
            }
            cb(null, clientDir);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = uuidv4();
            const extension = extname(file.originalname);
            cb(null, `${uniqueSuffix}${extension}`);
          },
        }),
        fileFilter: (req, file, cb) => {
          if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
            return cb(
              new BadRequestException('Only image files are allowed!'),
              false,
            );
          }
          cb(null, true);
        },
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB limit
        },
      }),
      inject: [ClsService], 
    }),
  ],
  controllers: [ImagesController],
  providers: [ImagesService, ImageRepository],
  exports: [ImagesService], 
})
export class ImagesModule {}