const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PHOTOS_DIR = path.join(__dirname, '..', 'photos');
const PHOTOS_FILE = path.join(__dirname, '..', 'js', 'data', 'photos.js');

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s, l };
}

function classifyColor(h, s, l) {
  if (s < 0.10) return 'grey';
  if (h < 15 || h >= 345) return 'red';
  if (h >= 15 && h < 45) return 'orange';
  if (h >= 45 && h < 70) return 'yellow';
  if (h >= 70 && h < 155) return 'green';
  if (h >= 155 && h < 235) return 'blue';
  if (h >= 235 && h < 275) return 'indigo';
  return 'violet';
}

async function run() {
  const content = fs.readFileSync(PHOTOS_FILE, 'utf8');
  const startMarker = 'export const photos = [';
  const endMarker = '];';
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.lastIndexOf(endMarker);
  const arrayContent = content.substring(startIndex + startMarker.length, endIndex);
  let localPhotos = new Function('return [' + arrayContent + ']')();

  const files = fs.readdirSync(PHOTOS_DIR).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.webp' || ext === '.jpg' || ext === '.jpeg' || ext === '.png';
  });

  const warmMultiplier = parseFloat(process.argv[2]) || 2.2;
  console.log(`Running analysis with warmMultiplier = ${warmMultiplier}...`);

  const results = [];

  for (const file of files) {
    const fullPath = path.join(PHOTOS_DIR, file);
    const photoInfo = localPhotos.find(p => p.src.includes(file)) || { title: `Untitled (${file})` };

    try {
      const { data, info } = await sharp(fullPath)
        .resize(50, 50, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixelCount = info.width * info.height;
      const colorBuckets = {
        red: 0,
        orange: 0,
        yellow: 0,
        green: 0,
        blue: 0,
        indigo: 0,
        violet: 0
      };

      let greyCount = 0;

      for (let i = 0; i < pixelCount; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const { h, s, l } = rgbToHsl(r, g, b);
        const color = classifyColor(h, s, l);
        
        if (color === 'grey') {
          greyCount++;
        } else {
          let weight = Math.pow(s, 2.5);
          // Apply warm multiplier
          if (color === 'red' || color === 'orange' || color === 'yellow') {
            weight *= warmMultiplier;
          }
          colorBuckets[color] += weight;
        }
      }

      let dominantColor = 'grey';
      if (greyCount / pixelCount >= 0.85) {
        dominantColor = 'grey';
      } else {
        let maxWeight = 0;
        for (const [color, weight] of Object.entries(colorBuckets)) {
          if (weight > maxWeight) {
            maxWeight = weight;
            dominantColor = color;
          }
        }
      }

      results.push({
        title: photoInfo.title || `Untitled (${file})`,
        file,
        color: dominantColor,
        greyRatio: (greyCount / pixelCount).toFixed(3)
      });
    } catch (err) {
      results.push({ title: photoInfo.title, file, color: 'error', error: err.message });
    }
  }

  // Sort by color to group them
  results.sort((a, b) => a.color.localeCompare(b.color));
  
  console.log(`\n=== RESULTS ===`);
  results.forEach(r => {
    console.log(`${r.color.toUpperCase().padEnd(7)} | ${r.title.padEnd(25)} | ${r.file}`);
  });
}

run();
