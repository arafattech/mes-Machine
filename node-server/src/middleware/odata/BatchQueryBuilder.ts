import { serializeBigInt } from "config/lib/BigIntPerser";
import { parseFilter } from "./lib/$filter.odata";
import { parseExpand } from "./lib/$expand.odata";
import { parseOrderBy } from "./lib/$orderby.odata";
import { parseSelect } from "./lib/$select.odata";

export interface PrismaQuery {
  where?: any;
  select?: any;
  include?: any;
  take?: number;
  skip?: number;
  orderBy?: any;
}

export class BatchQueryBuilder {
  static parse(url: string): {
    entity: string;
    id?: string;
    prismaQuery: PrismaQuery;
  } {
    const [path, queryString] = url.split("?");
    const pathParts = path.split("/").filter(Boolean);

    let entity = pathParts[0] || "";
    let id: string | undefined;

    const entityIdMatch = entity.match(/^(\w+)\((\d+)\)$/);
    if (entityIdMatch) {
      entity = entityIdMatch[1];
      id = entityIdMatch[2];
    } else if (pathParts[1]) {
      id = pathParts[1];
    }

    const params = new URLSearchParams(queryString || "");
    const prismaQuery: PrismaQuery = {};

    if (params.has("$select")) {
      prismaQuery.select = parseSelect(params.get("$select")!);
    }

    if (params.has("$filter")) {
      prismaQuery.where = parseFilter(params.get("$filter")! , entity);
    }

    if (params.has("$top")) prismaQuery.take = Number(params.get("$top"));
    if (params.has("$skip")) prismaQuery.skip = Number(params.get("$skip"));
    if (params.has("$orderby")) {
      prismaQuery.orderBy = parseOrderBy(params.get("$orderby")!);
    }

    if (params.has("$expand")) {
      prismaQuery.include = parseExpand(params.get("$expand")! , entity);
    }


    if (id) {
      prismaQuery.where = prismaQuery.where
        ? { AND: [{ id: serializeBigInt(id) }, prismaQuery.where] }
        : { id: serializeBigInt(id) };
    }


    if (entity.toLowerCase()=='users') {
      prismaQuery.select = {
        id: true,
        name: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
      };
    }

    return { entity, id, prismaQuery };
  }
}
