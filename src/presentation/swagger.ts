 
import type { SwaggerOptions } from '@fastify/swagger';
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

export const swaggerOptions: SwaggerOptions = {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'HRM Service API',
      description: 'API für Personal- und Zeitmanagement (HRM)',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3005',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'employees', description: 'Mitarbeiterverwaltung' },
      { name: 'time', description: 'Zeiterfassung' },
      { name: 'absences', description: 'Abwesenheitsverwaltung' },
      { name: 'reports', description: 'Berichte und Auswertungen' },
      { name: 'closing', description: 'Monatsabschluss' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
};

export const swaggerUiOptions: FastifySwaggerUiOptions = {
  routePrefix: '/docs',  
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
  },
  staticCSP: true,
};