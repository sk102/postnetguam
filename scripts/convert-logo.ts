import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SVG_PATH = path.join(__dirname, '../public/images/postnet-logo.svg');
const PNG_PATH = path.join(__dirname, '../public/images/postnet-logo.png');

async function convertLogo(): Promise<void> {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Convert SVG to PNG with 2x scale for high resolution
  await sharp(svgBuffer)
    .resize(498, 72) // 2x the original 249x36
    .png()
    .toFile(PNG_PATH);

  console.log('Logo converted successfully:', PNG_PATH);
}

convertLogo().catch(console.error);
