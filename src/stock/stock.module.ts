import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { StockLevel } from './entities/stock-level.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockService } from './stock.service';
import { ProductsModule } from '../products/modules/products.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockLevel,
      StockMovement,
    ]),
    ClsModule,
    forwardRef(() => ProductsModule), 
  ],
  providers: [StockService],
  exports: [StockService], 
})
export class StockModule {}
