/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ASPECT RATIO GENERATOR
 * ─────────────────────────────────────────────────────────────────────────────
 * This script detects the width/height of every image in public/data/photos.js
 * and adds an 'aspectRatio' field to the object.
 * 
 * This prevents Cumulative Layout Shift (CLS) in the masonry gallery.
 * 
 * Usage: node scripts/add-ratios.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PHOTOS_FILE = path.join(__dirname, '..', 'public', 'data', 'photos.js');

async function addRatios() {
  if (!fs.existsSync(PHOTOS_FILE)) {
    console.error('Error: public/data/photos.js not found!');
    return;
  }

  console.log('Reading public/data/photos.js...');
  const content = fs.readFileSync(PHOTOS_FILE, 'utf8');

  // Extract array using markers
  const startMarker = 'const photos = [';
  const endMarker = '];';
  
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.lastIndexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.error('Error: Could not locate "const photos = [" or "];" markers.');
    return;
  }

  const header = content.substring(0, startIndex + startMarker.length);
  const footer = content.substring(endIndex);
  const arrayContent = content.substring(startIndex + startMarker.length, endIndex);

  // Parse the array safely
  let photos;
  try {
    photos = eval(`[${arrayContent}]`);
  } catch (e) {
    console.error('Error parsing photos array:', e.message);
    return;
  }

  console.log(`Analyzing ${photos.length} photos for dimensions...`);

  for (let p of photos) {
    if (p.aspectRatio && p.aspectRatio !== 0) {
      // Skip if already has a ratio (unless you want to force update)
      // continue; 
    }

    try {
      const fullPath = path.join(__dirname, '..', p.src);
      if (fs.existsSync(fullPath)) {
        const metadata = await sharp(fullPath).metadata();
        if (metadata.width && metadata.height) {
          p.aspectRatio = parseFloat((metadata.width / metadata.height).toFixed(4));
        }
      } else {
        console.warn(`Warning: File not found: ${p.src}`);
      }
    } catch (e) {
      console.error(`Error detecting ratio for ${p.src}:`, e.message);
    }
  }

  // Re-generate the array content
  const serializedPhotos = photos.map(p => {
    return `  {
    src: ${JSON.stringify(p.src)},
    title: ${JSON.stringify(p.title || '')},
    desc: ${JSON.stringify(p.desc || '')},
    date: ${JSON.stringify(p.date || '')},
    location: ${JSON.stringify(p.location || '')},
    aspectRatio: ${p.aspectRatio || 0},
    category: ${JSON.stringify(p.category || '')},
    heroSlide: ${p.heroSlide || false},
  },`;
  }).join('\n');

  const finalOutput = `${header}\n${serializedPhotos}\n${footer}`;

  fs.writeFileSync(PHOTOS_FILE, finalOutput, 'utf8');
  console.log('Done! aspectRatios added to public/data/photos.js.');
}

addRatios();
