export const multipartSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true },
    category: { type: 'string', maxLength: 50, nullable: true },
    backgroundColor: { 
      type: 'string', 
      pattern: '^#[0-9A-Fa-f]{6}$',
      nullable: true 
    },
    opacity: { 
      type: 'number', 
      minimum: 0, 
      maximum: 1, 
      nullable: true 
    },
    isActive: { type: 'boolean', default: true },
    isPublic: { type: 'boolean', default: false },
    organizationId: { 
      type: 'string', 
      format: 'uuid', 
      nullable: true 
    },
  },
  required: ['name'],
};

export const fileSchema = {
  type: 'object',
  properties: {
    filename: { type: 'string' },
    mimetype: { type: 'string' },
    encoding: { type: 'string' },
  },
  required: ['filename', 'mimetype', 'encoding'],
};