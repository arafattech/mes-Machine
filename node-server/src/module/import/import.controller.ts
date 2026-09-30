import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { ImportService } from '@module/import/import.service';

@Controller()
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get()
  getHello() {
    return { message: 'File_system works' };
  }

  @Post('employees')
  @UseInterceptors(FileInterceptor('file'))
  async addFile(@Req() request: Request, @UploadedFile() file: Express.Multer.File) {
    return this.importService.importEmployees(request, file);
  }
}
