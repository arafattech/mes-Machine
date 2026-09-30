import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect().then((res:any)=>{
   console.log('Database connected successfully');
    }).catch((err)=>{
      console.log('somthing went wrong')
    })
 
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
