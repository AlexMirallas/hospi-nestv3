import {
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent,
    UpdateEvent,
    DataSource,
  } from 'typeorm';
  import { Injectable } from '@nestjs/common';
  import { ClsService } from 'nestjs-cls';
  
  @Injectable()
  @EventSubscriber() 
  export class TenantSubscriber implements EntitySubscriberInterface {
    constructor(
      private readonly dataSource: DataSource,
      private readonly cls: ClsService,
    ) {
      dataSource.subscribers.push(this);
    }
  
    beforeInsert(event: InsertEvent<any>): void {
      const clientId = this.cls.get('clientId');
      if (clientId && event.metadata.findColumnWithPropertyName('clientId') && !event.entity.clientId) {
         event.entity.clientId = clientId;
      }
    }
  
    beforeUpdate(event: UpdateEvent<any>) {
        const clientId = this.cls.get('clientId');

       if (event.databaseEntity?.clientId && event.entity?.clientId && event.databaseEntity.clientId !== event.entity.clientId) {
           console.warn(`Attempted to change clientId for entity ${event.metadata.name} ID ${event.databaseEntity.id}. Reverting.`);
           event.entity.clientId = event.databaseEntity.clientId;
       }
    
        if (clientId && event.metadata.findColumnWithPropertyName('clientId') && event.entity && !event.entity.clientId) {
           event.entity.clientId = clientId;
        }
     }
  }