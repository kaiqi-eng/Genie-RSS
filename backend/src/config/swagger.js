import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Genie-RSS API',
      version: '1.0.0',
      description: 'RSS feed discovery, processing, and AI-powered summarization API',
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Bearer token for authenticated routes',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
              description: 'Validation error details',
            },
          },
        },
        FeedItem: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            link: { type: 'string' },
            content: { type: 'string' },
            pubDate: { type: 'string' },
            source: { type: 'string' },
          },
        },
        Feed: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            link: { type: 'string' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/FeedItem' },
            },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: ['./src/routes/*.js', './src/index.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
