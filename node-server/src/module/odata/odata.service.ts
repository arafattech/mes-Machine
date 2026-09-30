import {
  Injectable,
  NotFoundException,
  BadRequestException,
  MethodNotAllowedException,
} from '@nestjs/common';
import { serializeBigInt } from 'config/lib/BigIntPerser';
import { PrismaService } from '@prisma/prisma.service';
import { BatchQueryBuilder } from 'middleware/odata/BatchQueryBuilder';
import Redis from 'ioredis';
import { CreateRedisCache, GetRedisCache, RemoveRedisCache } from 'config/redis/config.redis';
import { Prisma } from '@prisma/client';
@Injectable()
export class OdataService {
  private prisma = new PrismaService();
  DbCounter: number = 0;
  RedisCounter: number = 0;

  async getAll(entity: string, req?: any, isbatch?: boolean, batchQuery?: any) {
    console.log('route:', entity, '\n', '\n', 'DB : ', this.DbCounter, 'Redis :', this.RedisCounter, '\n');

    // return req.calculation

    const host = req.get('host');
    const protocol = req.protocol;
    const model = this.prisma[entity.toLowerCase()];

    if (!model)
      throw new NotFoundException(`Entity ${entity} not found in ${req.method}`);

    const cacheKey = `odata:${entity}:${JSON.stringify({main:(isbatch ? batchQuery : req.prismaQuery),calculation: req.calculation, count:req.showCount})}`;
    try {

      let cached = await GetRedisCache(cacheKey);
      if (cached) {
        this.RedisCounter += 1;
        return cached;
      }

      const data = await model.findMany(isbatch ? batchQuery : req.prismaQuery);

      let cal_Data: any | null;
      if (req.calculation._sum || req.calculation._avg && !req.calculation !== null) {

        cal_Data = await model.aggregate(Object.fromEntries(
          Object.entries({
            where: isbatch ? batchQuery : req.prismaQuery.where ?? {},
            _sum: req.calculation._sum,
            _avg: req.calculation._avg,
          }).filter(([, value]) => value !== undefined)
        ))
      }

      this.DbCounter += 1;
      const result = {
        '@odata.context': `${protocol}://${host}/odata/v3/$metadata#${entity}`,
        value: serializeBigInt(data) ?? [],
        calculation: cal_Data ?? undefined,
        '@count': req.showCount ? await model.count() : undefined,
      };

      await CreateRedisCache(cacheKey, result)

      return result;
    } catch (error) {
      throw new BadRequestException({
        message: `Failed to get record in '${entity}'`,
        error: error.message,
      });
    }
  }

  // get one 
  async getOne(entity: string, id: string, req?: any) {
    let host = req.get('host');
    let protocol = req.protocol;
    const model = this.prisma[entity.toLowerCase()];
    if (!model)
      throw new NotFoundException(
        `Entity ${entity} not found in ${req.method}`,
      );
    else if (!id)
      throw new BadRequestException(
        `Entity ${entity} not found in ${req.method}`,
      );

    try {
      const data = await model.findUnique(req.prismaQuery);

      return {
        '@odata.context': `${protocol}://${host}/odata/v3/$metadata#${entity}(${id})`,
        value: serializeBigInt(data) ?? [],
      };
    } catch (error) {
      throw new BadRequestException({
        message: `Failed to get record in '${entity}'`,
        error: error.message,
      });
    }
  }


  // create query handler
  async create(entity: string, req: any, isbatch?: boolean, batchBody?: any) {
    let host = req.get('host');
    let protocol = req.protocol;
    const model = this.prisma[entity.toLowerCase()];
    if (!model) {
      throw new NotFoundException(`Entity ${entity} not found`);
    }

    if (req.id)
      throw new MethodNotAllowedException({
        error: `${entity}(${req.id}) not allowed in ${req.method}`,
        statusCode: 405,
      });

    try {
      const data = await model.create({
        data: isbatch ? batchBody[0] : req.body,
      });

      await RemoveRedisCache(entity)
      return {
        '@odata.context': `${protocol}://${host}/odata/v8/$metadata#${entity}`,
        value: serializeBigInt(data) ?? [],
      };
    } catch (error) {
      throw new BadRequestException({
        message: `Failed to create record in '${entity}'`,
        error: error.message,
      });
    }
  }

  // update query handler
  async update(
    entity: string,
    id: string,
    req: any,
    isBatch?: boolean,
    batchBody?: any,
  ) {
    const model = this.prisma[entity.toLowerCase()];
    let host = req.get('host');
    let protocol = req.protocol;
    if (!model)
      throw new NotFoundException(
        `Entity ${entity} not found in ${req.method}`,
      );
    else if (!id)
      throw new BadRequestException(
        `Entity ${entity} not found in ${req.method}`,
      );

    try {
      const data = await model.update({
        where: { id: Number(id) },
        data: isBatch ? batchBody[0] : req.body,
      });

      await RemoveRedisCache("odata:" + entity)
      return {
        '@odata.context': `${protocol}://${host}/odata/v8/$metadata#${entity}${`(${id})`}`,
        value: serializeBigInt(data) ?? [],
      };
    } catch (error) {
      if (error.meta?.cause) {
        throw new BadRequestException({ error: error.meta.cause });
      }
      throw new BadRequestException({ error: error.message });
    }
  }

  async delete(entity: string, id: string, req: any) {
    const model = this.prisma[entity.toLowerCase()];
    if (!model)
      throw new NotFoundException(
        `Entity ${entity} not found in ${req.method}`,
      );
    else if (!id)
      throw new BadRequestException(
        `Entity ${entity} not found in ${req.method}`,
      );
    try {
      const data = await model.delete({
        where: { id: Number(id) },
      });

      await RemoveRedisCache("odata:" + entity)

      return {
        '@odata.context': `${req.protocol}://${req.get(
          'host',
        )}/odata/v3/$metadata#${entity}${`(${id})`}`,
        value: serializeBigInt(data) ?? [],
      };
    } catch (error) {
      if (error.meta?.cause) {
        throw new BadRequestException({ error: error.meta.cause });
      }
      throw new BadRequestException({ error: error.message });
    }
  }

  // =========== $batch ==============

  async batchCall(body: any, req: any) {

    if (!Array.isArray(body.requests)) {
      return { error: 'Batch request must be an array of operations' };
    }

    const results = await Promise.all(
      body?.requests.map(async (item: any) => {
        try {
          const method = item.method?.toUpperCase();
          const bodyPayload = item.body ?? {};
          let result: any;
          const { prismaQuery, id, entity } = BatchQueryBuilder.parse(item.url);


          switch (method) {
            case 'GET':
              result = await this.getAll(entity, req, true, prismaQuery);
              break;
            case 'POST':
              result = await this.create(entity, req, true, bodyPayload);
              break;
            case 'PUT':
              result =
                id && (await this.update(entity, id, req, true, bodyPayload));
              break;
            case 'DELETE':
              result = id && (await this.delete(entity, id, req));
              break;
            default:
              result = { error: `Unsupported method ${method}` };
          }

          return {
            id: String(item.id),
            method: method,
            status: 200,
            headers: { 'content-type': req.headers['content-type'] },
            body: result,
          };
        } catch (err) {
          return {
            id: String(item.id),
            method: item.method,
            status: err.status || 500,
            headers: { 'content-type': 'application/json' },
            body: { error: err.message || 'Unknown error' },
          };
        }
      }),
    );

    return { responses: results };
  }
}
