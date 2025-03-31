import { Module, Global } from '@nestjs/common';

@Global() // Make guards/etc available globally if needed, or import explicitly
@Module({
  providers: [
    // If you need guards/etc outside this module, export them
    // Or make CommonModule global as shown above
  ],
  exports: [
    // Export anything needed by other modules
  ],
})
export class CommonModule {}
