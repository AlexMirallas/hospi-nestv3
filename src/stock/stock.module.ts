import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { StockLevel } from './entities/stock-level.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockService } from './stock.service';
import { ProductsModule } from '../products/modules/products.module'; 
import { AuthModule } from 'src/auth/auth.module';
import { StockMovementController } from './stock-movements.controller';
import { AdjustStockController } from './adjust-stock.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockLevel,
      StockMovement,
    ]),
    ClsModule,
    AuthModule,
    forwardRef(() => ProductsModule), 
  ],
  providers: [StockService],
  controllers: [StockMovementController,AdjustStockController],
  exports: [StockService], 
})
export class StockModule {}
