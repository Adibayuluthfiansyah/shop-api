import { Injectable } from '@nestjs/common';
import {
  UploadApiResponse,
  UploadApiErrorResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: 'shop-products',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
          transformation: [{ width: 800, crop: 'limit' }],
        },
        (error, result) => {
          if (error) {
            return reject(
              new Error(error.message || 'Cloudinary Upload Failed'),
            );
          }
          if (!result) {
            return reject(
              new Error('Cloudinary upload failed: No result returned'),
            );
          }

          resolve(result);
        },
      );
      Readable.from(file.buffer).pipe(upload);
    });
  }
}
