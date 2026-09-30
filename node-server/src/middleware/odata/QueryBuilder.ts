import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { parseFilter } from '../odata/lib/$filter.odata'
import { parseExpand } from '../odata/lib/$expand.odata'
import { parseSelect } from '../odata/lib/$select.odata';
import { parseOrderBy } from '../odata/lib/$orderby.odata'
import { parseCount } from './lib/$count.odata';
import { protectedUser } from './protected/users.odata';
import { parseAvg, parseSum } from './lib/math.odata';
@Injectable()
export class QueryBuilder implements NestMiddleware {
  use(req: Request | any, res: Response, next: NextFunction) {

    const cleanQuery = Object.fromEntries(
      Object.entries(req.query).map(([key, value]) => [key.trim(), value])
    );

    const query: any = {};
    const paramsParts = req.path.split('/').filter(Boolean);

    if (paramsParts.length >= 3) {
      let entityPart = paramsParts[2];
      let entity = entityPart;
      let id: string | undefined = undefined;

      if (cleanQuery) {
        const { $select, $filter, $top, $skip, $orderby, $expand, $auth } =
          cleanQuery;
        const filtersArray = Array.isArray($filter)
          ? $filter
          : $filter
            ? [$filter]
            : [];

        const validFilter = filtersArray.filter((rm_filed: any) => rm_filed && rm_filed.trim() !== '');

        if ($select) query.select = parseSelect($select as string);
        if (validFilter && validFilter.length > 0) query.where = parseFilter(String(validFilter) as string, entity);
        if ($top) query.take = Number($top) ?? 0;
        if ($skip) query.skip = Number($skip) ?? 0;
        if ($orderby && String($orderby).trim() !== '') query.orderBy = parseOrderBy($orderby as string);

        if ($expand) {
          const expandObj = parseExpand($expand as string, entity, $select ? true : false);
          if (query.select) query.select = { ...query.select, ...expandObj };
          else query.include = expandObj;


        }
      }

      //  prefix and id , next time lagbe for parts
      const match = entityPart.match(/^(\w+)\((\d+)\)$/);
      if (match) {
        entity = match[1];
        id = match[2];
      } else if (paramsParts[3]) {
        id = paramsParts[3];
      }

      if (id) {
        let parsedId: number | bigint;
        if (typeof id === "bigint" || (typeof id === "string" && id.endsWith("n"))) {
          parsedId = BigInt(id);
        } else {
          const num = Number(id);
          parsedId = Number.isSafeInteger(num) ? num : BigInt(id);
        }

        query.where = query.where
          ? { AND: [{ id: parsedId }, query.where] }
          : { id: parsedId };
      }

      if (query?.include?.users) {
        query.include.users = protectedUser;
      }

      if (entity == "users") {
        query.select = protectedUser;

      }

      const countData = parseCount(req.query.$count)?.data?._count;
      const sumData = parseSum(req.query.$sum)?.data?._sum;
      const avgData = parseAvg(req.query.$avg)?.data?._avg;

      const hasAnyKeys = (data?: object) => !!data && Object.keys(data).length > 0;

      const hasCount =
        !!countData && (
          countData.select ? hasAnyKeys(countData.select) : hasAnyKeys(countData)
        );

      const hasSum = hasAnyKeys(sumData);
      const hasAvg = hasAnyKeys(avgData);

      const aggs = {
        ...(hasCount ? { _count: countData } : {}),
      };

      if (query && Object.keys(aggs).length) {
        const target = query.select ? 'select' : query.include ? 'include' : null;
        if (target) query[target] = { ...query[target], ...aggs };
      }


      req['entity'] = entity;
      req['id'] = id;
      req['prismaQuery'] = query;
      req['calculation'] ={  ...(hasSum ? { _sum: sumData } : {}) , ...(hasAvg? {_avg:avgData}: {})}
      req['showCount'] = parseCount(req.query.$count).data._main
    }
    next();

  }

}