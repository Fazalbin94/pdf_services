
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'; 
const SYSTEM_ORGANIZATION_ID = '11111111-1111-1111-1111-111111111111';  

const SYSTEM_LETTERHEADS = [
  {
    name: 'company-letterhead',
    description: 'Official company letterhead with logo and contact information',
    category: 'official',
    fileUrl: 'https://example.com/letterheads/company-letterhead.pdf',
    thumbnailUrl: 'https://example.com/letterheads/company-letterhead-thumb.jpg',
    fileSize: 102400, // 100KB
    fileType: 'PDF',
    mimeType: 'application/pdf',
    width: 2480,
    height: 3508, // A4 at 300 DPI
    dpi: 300,
    backgroundColor: '#FFFFFF',
    opacity: 1.0,
    marginSafeZone: { top: 100, right: 100, bottom: 100, left: 100 },
    isActive: true,
    isPublic: true,
    isSystem: true,
    usageCount: 0,
    userId: SYSTEM_USER_ID,
    organizationId: SYSTEM_ORGANIZATION_ID,
  },
  {
    name: 'simple-background',
    description: 'Clean, simple background for professional documents',
    category: 'backgrounds',
    fileUrl: 'https://example.com/letterheads/simple-background.png',
    thumbnailUrl: 'https://example.com/letterheads/simple-background-thumb.jpg',
    fileSize: 51200, // 50KB
    fileType: 'IMAGE',
    mimeType: 'image/png',
    width: 2480,
    height: 3508,
    dpi: 300,
    backgroundColor: '#F8F9FA',
    opacity: 0.8,
    marginSafeZone: { top: 80, right: 80, bottom: 80, left: 80 },
    isActive: true,
    isPublic: true,
    isSystem: true,
    usageCount: 0,
    userId: SYSTEM_USER_ID,
    organizationId: SYSTEM_ORGANIZATION_ID,
  },
  {
    name: 'watermark-logo',
    description: 'Subtle watermark with company logo',
    category: 'watermarks',
    fileUrl: 'https://example.com/letterheads/watermark-logo.svg',
    thumbnailUrl: 'https://example.com/letterheads/watermark-logo-thumb.jpg',
    fileSize: 20480, // 20KB
    fileType: 'SVG',
    mimeType: 'image/svg+xml',
    width: 1024,
    height: 1024,
    dpi: 72,
    backgroundColor: null,
    opacity: 0.2,
    marginSafeZone: { top: 0, right: 0, bottom: 0, left: 0 },
    isActive: true,
    isPublic: true,
    isSystem: true,
    usageCount: 0,
    userId: SYSTEM_USER_ID,
    organizationId: SYSTEM_ORGANIZATION_ID,
  },
];

const SYSTEM_PDF_TEMPLATES = [
  {
    name: 'invoice-template',
    title: 'Invoice Template',
    description: 'Professional invoice template with itemized billing',
    category: 'invoices',
    tags: ['invoice', 'billing', 'commercial'],
    config: {
      elements: [
        {
          type: 'header',
          position: { x: 0, y: 50 },
          content: '{{companyName}}',
          style: { fontSize: 24, fontWeight: 'bold', color: '#333333' }
        },
        {
          type: 'text',
          position: { x: 0, y: 100 },
          content: 'Invoice #{{invoiceNumber}}',
          style: { fontSize: 18, color: '#666666' }
        },
        {
          type: 'table',
          position: { x: 0, y: 200 },
          columns: [
            { key: 'description', label: 'Description', width: 200 },
            { key: 'quantity', label: 'Qty', width: 80 },
            { key: 'unitPrice', label: 'Unit Price', width: 100 },
            { key: 'total', label: 'Total', width: 100 }
          ]
        }
      ]
    },
    variables: {
      companyName: { type: 'string', required: true },
      invoiceNumber: { type: 'string', required: true },
      invoiceDate: { type: 'date', required: true },
      items: { type: 'array', required: true }
    },
    validationRules: {
      invoiceNumber: { pattern: '^INV-\\d{6}$', message: 'Invoice number must be in format INV-000000' }
    },
    pageSize: 'A4',
    orientation: 'PORTRAIT',
    margins: { top: 72, right: 72, bottom: 72, left: 72 },
    backgroundType: 'LETTERHEAD',
    backgroundColor: '#FFFFFF',
    opacity: 1.0,
    version: '1.0.0',
    isActive: true,
    isPublic: true,
    isSystem: true,
    userId: SYSTEM_USER_ID,
    organizationId: SYSTEM_ORGANIZATION_ID,
  },
  {
    name: 'contract-template',
    title: 'Standard Contract',
    description: 'Legal contract template with signature fields',
    category: 'contracts',
    tags: ['legal', 'contract', 'agreement'],
    config: {
      elements: [
        {
          type: 'section',
          position: { x: 0, y: 100 },
          title: 'Agreement',
          content: 'This Agreement is made and entered into as of {{effectiveDate}}...'
        },
        {
          type: 'signature',
          position: { x: 100, y: 600 },
          label: 'Party A Signature',
          fieldName: 'partyASignature'
        },
        {
          type: 'signature',
          position: { x: 400, y: 600 },
          label: 'Party B Signature',
          fieldName: 'partyBSignature'
        }
      ]
    },
    variables: {
      effectiveDate: { type: 'date', required: true },
      partyAName: { type: 'string', required: true },
      partyBName: { type: 'string', required: true },
      partyASignature: { type: 'image', required: false },
      partyBSignature: { type: 'image', required: false }
    },
    pageSize: 'LETTER',
    orientation: 'PORTRAIT',
    margins: { top: 90, right: 90, bottom: 90, left: 90 },
    backgroundType: 'COLOR',
    backgroundColor: '#FFFFFF',
    opacity: 1.0,
    version: '1.0.0',
    isActive: true,
    isPublic: true,
    isSystem: true,
    userId: SYSTEM_USER_ID,
    organizationId: SYSTEM_ORGANIZATION_ID,
  },
  {
    name: 'report-template',
    title: 'Monthly Report',
    description: 'Business report template with charts and analytics',
    category: 'reports',
    tags: ['report', 'analytics', 'business'],
    config: {
      elements: [
        {
          type: 'header',
          position: { x: 0, y: 50 },
          content: 'Monthly Performance Report - {{month}} {{year}}',
          style: { fontSize: 22, fontWeight: 'bold' }
        },
        {
          type: 'chart',
          position: { x: 50, y: 150 },
          chartType: 'bar',
          dataField: 'performanceData'
        },
        {
          type: 'summary',
          position: { x: 50, y: 400 },
          content: '{{summary}}'
        }
      ]
    },
    variables: {
      month: { type: 'string', required: true },
      year: { type: 'number', required: true },
      performanceData: { type: 'array', required: true },
      summary: { type: 'text', required: true }
    },
    pageSize: 'A4',
    orientation: 'LANDSCAPE',
    margins: { top: 60, right: 60, bottom: 60, left: 60 },
    backgroundType: 'NONE',
    backgroundColor: '#F5F5F5',
    opacity: 1.0,
    version: '1.0.0',
    isActive: true,
    isPublic: true,
    isSystem: true,
    userId: SYSTEM_USER_ID,
    organizationId: SYSTEM_ORGANIZATION_ID,
  },
];

async function seedSystemLetterheads() {
  console.log('Seeding system letterheads...');

  for (const letterhead of SYSTEM_LETTERHEADS) {
    const existing = await prisma.letterhead.findFirst({
      where: {
        name: letterhead.name,
        isSystem: true,
        userId: SYSTEM_USER_ID,
      },
    });

    if (existing) {
      console.log(`Letterhead "${letterhead.name}" already exists, skipping...`);
      continue;
    }

    await prisma.letterhead.create({
      data: letterhead,
    });

    console.log(`Created letterhead: ${letterhead.name}`);
  }

  console.log('Done seeding letterheads!');
}

async function seedSystemPdfTemplates() {
  console.log('Seeding system PDF templates...');

  for (const template of SYSTEM_PDF_TEMPLATES) {
    const existing = await prisma.pdfTemplate.findFirst({
      where: {
        name: template.name,
        isSystem: true,
        userId: SYSTEM_USER_ID,
      },
    });

    if (existing) {
      console.log(`PDF template "${template.name}" already exists, skipping...`);
      continue;
    }


    const createdTemplate = await prisma.pdfTemplate.create({
      data: template,
    });


    await prisma.pdfTemplateStats.create({
      data: {
        templateId: createdTemplate.id,
        viewCount: 0,
        generationCount: 0,
        previewCount: 0,
        downloadCount: 0,
      },
    });

    console.log(`Created PDF template: ${template.title}`);
  }

  console.log('Done seeding PDF templates!');
}

async function seedPdfService() {
  console.log('Starting PDF Service seeding...');


  await seedSystemLetterheads();
  

  await seedSystemPdfTemplates();

  console.log('PDF Service seeding completed successfully!');
}


seedPdfService()
  .catch((error) => {
    console.error('Error seeding PDF service:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });