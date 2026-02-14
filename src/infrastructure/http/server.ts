import fastifyMultipart from '@fastify/multipart';
import fp from 'fastify-plugin';

export const configureMultipart = fp(async (fastify) => {
  await fastify.register(fastifyMultipart, {
    
    limits: {
      fieldNameSize: 100, 
      fieldSize: 100,     
      fields: 10,        
      fileSize: 10 * 1024 * 1024,  
      files: 1,          
      headerPairs: 2000,   
    },
    
    attachFieldsToBody: false, 
    sharedSchemaId: '#multipartFile', 
  });
});