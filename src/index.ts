import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { processImage } from './processor.js';
import { createReadStream, createWriteStream } from 'node:fs';
import fetch from 'node-fetch';
import { AllowedTypes, getExtensionFromMime } from './mimetype.js';

const HOST = 'http://localhost';
const PORT = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true,
        levelFirst: true,
      },
    },
  },
});

// Register plugins
fastify.register(multipart);
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../uploads'),
  prefix: '/downloads/',
});

// Create uploads directory
const uploadsDir = path.join(__dirname, '../uploads');
await fs.mkdir(uploadsDir, { recursive: true });

fastify.get('/', async () => {
  return { message: 'Hello sharp' };
});

fastify.post('/upload', async (request, reply) => {
  const data = await request.file();
  if (!data) {
    throw new Error('No file uploaded');
  }

  if (!AllowedTypes.includes(data.mimetype)) {
    throw new Error('Invalid file type. Only images are allowed.');
  }

  const originalExt = path.extname(data.filename);
  const extension = getExtensionFromMime(data.mimetype, originalExt);
  const filename = `${Date.now()}-${path.basename(
    data.filename,
    originalExt
  )}${extension}`;
  const filepath = path.join(uploadsDir, filename);

  await pipeline(data.file, createWriteStream(filepath));

  const { path: processedPath } = await processImage(filepath);
  const processedFilename = path.basename(processedPath);

  const downloadUrl = `${HOST}:${PORT}/download/${processedFilename}`;

  const downloadPath = path.join(process.cwd(), 'downloads', processedFilename);
  await fs.mkdir(path.dirname(downloadPath), { recursive: true });

  const response = await fetch(downloadUrl);
  const fileStream = createWriteStream(downloadPath);
  await new Promise((resolve, reject) => {
    response.body?.pipe(fileStream);
    response.body?.on('error', reject);
    fileStream.on('finish', resolve);
  });

  return {
    message: 'File processed and downloaded successfully',
    downloadUrl,
    savedPath: downloadPath,
  };
});

fastify.get('/download/:filename', async (request, reply) => {
  const { filename } = request.params as { filename: string };
  const filepath = path.join(uploadsDir, filename);

  try {
    await fs.access(filepath);
    reply
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .type('image/jpeg')
      .send(createReadStream(filepath));
  } catch (error) {
    reply.code(404).send({ message: 'File not found' });
  }
});

try {
  await fastify.listen({ port: PORT });
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
