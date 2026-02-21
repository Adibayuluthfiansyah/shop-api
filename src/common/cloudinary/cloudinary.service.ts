import { Injectable, Logger } from '@nestjs/common';
import {
  UploadApiResponse,
  UploadApiErrorResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      // Log cloudinary config for debugging
      const config = cloudinary.config();
      this.logger.debug(`Cloudinary config - cloud_name: ${config.cloud_name}, api_key: ${config.api_key ? 'SET' : 'NOT SET'}`);

      if (!config.cloud_name || !config.api_key || !config.api_secret) {
        return reject(new Error('Cloudinary credentials are not configured properly'));
      }

      const upload = cloudinary.uploader.upload_stream(
        {
          folder: 'shop-products',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
          transformation: [{ width: 800, crop: 'limit' }],
        },
        (error, result) => {
          if (error) {
            this.logger.error(`Cloudinary upload error: ${error.message}`);
            return reject(
              new Error(error.message || 'Cloudinary Upload Failed'),
            );
          }
          if (!result) {
            return reject(
              new Error('Cloudinary upload failed: No result returned'),
            );
          }

          this.logger.debug(`Cloudinary upload success: ${result.secure_url}`);
          resolve(result);
        },
      );
      Readable.from(file.buffer).pipe(upload);
    });
  }
}
