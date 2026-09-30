import {
  All,
  Controller,
  Header,
  Req,
} from '@nestjs/common';
import { OdataService } from './odata.service';

@Controller('odata/v8')
export class OdataController {
  constructor(private readonly odataService: OdataService) { }

  @All('*')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Surrogate-Control', 'no-store')

  async OdataHandler(@Req() req: any) {

    const entity = req.entity;
    const id = req.id;
    const method = req.method;
    switch (method) {
      case 'GET':
        if (id) {
          return this.odataService.getOne(entity, id, req);
        } else {
          return this.odataService.getAll(entity, req);
        }
      case 'POST':
        if (entity === "$batch" && !id) { return this.odataService.batchCall(req.body , req) }
        else {
          return this.odataService.create(entity, req);
        }
      case 'PUT':
        return this.odataService.update(entity, id, req);
      case 'DELETE':
        return this.odataService.delete(entity, id, req);
      default:
        return 'Method not allowed!';
    }
  }


}
