import imagemin, { type Plugin } from 'imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import imageminWebp from 'imagemin-webp';
import sharp from 'sharp';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

interface ProcessedImage {
  path: string;
  metadata: sharp.Metadata;
}

async function compressImage(
  inputPath: string,
  outputPath: string,
  format: string
) {
  const buffer = await fs.readFile(inputPath);
  let plugins: Plugin[] = [];

  switch (format) {
    case 'jpeg':
      plugins = [imageminMozjpeg({ quality: 70 })];
      break;
    case 'png':
      plugins = [imageminPngquant({ quality: [0.6, 0.8] })];
      break;
    case 'webp':
      plugins = [imageminWebp({ quality: 70 })];
      break;
  }

  const compressedBuffer = await imagemin.buffer(buffer, {
    plugins,
  });

  await fs.writeFile(outputPath, compressedBuffer);
}

export async function processImage(filepath: string): Promise<ProcessedImage> {
  const filename = path.basename(filepath);
  const extension = path.extname(filename);
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const metadata = await sharp(filepath).metadata();
  console.log('metadata', metadata);

  const outputPath = path.join(
    __dirname,
    '../uploads',
    `processed-${path.basename(filename, extension)}${extension}`
  );

  const tempPath = outputPath + '.temp';
  await sharp(filepath).sharpen().toFile(tempPath);

  await compressImage(tempPath, outputPath, metadata.format || 'jpeg');

  await fs.unlink(tempPath);

  const finalMetadata = await sharp(outputPath).metadata();
  return { path: outputPath, metadata: finalMetadata };
}
