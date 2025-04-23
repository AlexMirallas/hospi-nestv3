import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }


  @Get('health')
  async checkHealth() {
    try {
      const isConnected = this.dataSource.isInitialized;
      
      return {
        status: 'ok',
        database: isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        databaseName: this.dataSource.options.database,
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
