import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  Delete,
  Param,
  Get,
  Body,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { basename, dirname, extname, join } from 'path';
import { existsSync, mkdirSync, renameSync } from 'fs';
import { MediaService } from './media.service';
import sharp from 'sharp';


@Controller()
export class MediaController {
  constructor(private readonly mediaService: MediaService) { }

  @Post('upload')
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'media' }],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            let folder = 'others';
            if (file.mimetype.startsWith('image/')) folder = 'images';
            else if (file.mimetype.startsWith('video/')) folder = 'videos';

            const uploadPath = join(process.cwd(), 'storage', 'public', folder);
            if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });

            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, uniqueName + extname(file.originalname));
          },
        }),
      },
    ),
  )
  async uploadMedia(
    @UploadedFiles()
    files: { media?: Express.Multer.File[] },
    @Body() body: { userid: string; productid: string, isprofile?: boolean| string }
  ) {
    const savedMedia: any[] = [];
     console.log(body, 'body');
    for (const file of files.media || []) {
      const folder = file.mimetype.startsWith('image/') ? 'images' :
        file.mimetype.startsWith('video/') ? 'videos' : 'others';

      if (file.mimetype.startsWith('image/')) {
        await this.compressImage(join('storage', 'public', 'images', file.filename), 10);

        const { size } = require('fs').statSync(join('storage', 'public', 'images', file.filename));
        file.size = size;
      }
      // const media = await this.mediaService.createMedia({
      //   productId: body.productid ? Number(body.productid) : undefined,
      //   userId: body.userid ? Number(body.userid) : undefined,
      //   fileName: file.filename,
      //   filePath: join('storage', 'public', folder, file.filename),
      //   fileType: file.mimetype,
      //   fileSize: file.size,
      //   isProfile: body.isprofile? true: false
      // });
      // savedMedia.push(media);
    }

    return { message: 'Upload successful', savedMedia };
  }

  async compressImage(fileDiractory: any, quality: number) {
    try {
      const tempPath = join(dirname(fileDiractory), `temp-${basename(fileDiractory)}`);
      await sharp(fileDiractory)
        .jpeg({ quality })
        .toFile(tempPath);
      renameSync(tempPath, fileDiractory);
    } catch (error) {
      console.error('Error compressing image:', fileDiractory, error);
    }
  }

  // @Delete(':id')
  // async deleteMedia(@Param('id') id: string) {
  //   return this.mediaService.deleteMedia(Number(id));
  // }

  // @Get()
  // async getAllMedia() {
  //   return this.mediaService.getAllMedia();
  // }
}
