import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';

interface RequestWithCsrf extends Request {
  csrfToken(): string;
}

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({
    summary: 'API Welcome Message',
    description: 'Returns a welcome message for the API root endpoint',
  })
  @ApiResponse({
    status: 200,
    description: 'Welcome message',
    schema: {
      type: 'string',
      example: 'Welcome to E-Commerce Shop API',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Health Check',
    description:
      'Returns the health status of the API. Use this endpoint to verify the service is running.',
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy and running',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'ok',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2024-02-08T10:30:00.000Z',
        },
        uptime: {
          type: 'number',
          description: 'Process uptime in seconds',
          example: 12345.67,
        },
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
  @Get('csrf-token')
  @ApiOperation({
    summary: 'Get CSRF Token',
    description:
      'Fetches a unique CSRF token required for mutation requests (POST, PUT, DELETE)',
  })
  @ApiResponse({
    status: 200,
    description: 'CSRF Token successfully retrieved',
    schema: {
      type: 'object',
      properties: {
        csrfToken: {
          type: 'string',
          example: 'E8s9d... (random token)',
        },
      },
    },
  })
  getCsrfToken(@Req() request: RequestWithCsrf) {
    return { csrfToken: request.csrfToken() };
  }
}
