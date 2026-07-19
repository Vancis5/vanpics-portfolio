const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PHOTOS_DIR = path.join(__dirname, '..', 'photos');
const PHOTOS_FILE = path.join(__dirname, '..', 'js', 'data', 'photos.js');
const OUTPUT_FILE = path.join(__dirname, '..', 'js', 'data', 'photo-colors.ts');

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
  // A pixel is grey if saturation is extremely low (virtually monochromatic)
  if (s < 0.06) {
    return 'grey';
  }
  if (h < 15 || h >= 345) return 'red';
  if (h >= 15 && h < 45) return 'orange';
  if (h >= 45 && h < 70) return 'yellow';
  if (h >= 70 && h < 155) return 'green';
  if (h >= 155 && h < 235) return 'blue';
  if (h >= 235 && h < 275) return 'indigo';
  return 'violet';
}



function findLocalMatch(livePhoto, localPhotos) {
  // Try 1: check if live src filename matches local src filename
  const liveFilename = path.basename(livePhoto.src);
  for (const local of localPhotos) {
    const localFilename = path.basename(local.src);
    if (liveFilename === localFilename) return local;
  }

  // Try 2: match by title
  if (livePhoto.title) {
    const liveTitleClean = livePhoto.title.toLowerCase().trim();
    for (const local of localPhotos) {
      if (local.title && local.title.toLowerCase().trim() === liveTitleClean) {
        return local;
      }
    }
  }

  // Try 3: match by aspect ratio and date
  if (livePhoto.aspect_ratio && livePhoto.date) {
    for (const local of localPhotos) {
      const ratioDiff = Math.abs((livePhoto.aspect_ratio) - (local.aspectRatio || 0));
      if (ratioDiff < 0.005 && livePhoto.date.toLowerCase().trim() === (local.date || '').toLowerCase().trim()) {
        return local;
      }
    }
  }

  // Try 4: match by description
  if (livePhoto.desc) {
    const liveDescClean = livePhoto.desc.toLowerCase().trim().replace(/<[^>]*>/g, '');
    for (const local of localPhotos) {
      if (local.desc) {
        const localDescClean = local.desc.toLowerCase().trim().replace(/<[^>]*>/g, '');
        if (liveDescClean === localDescClean || liveDescClean.includes(localDescClean) || localDescClean.includes(liveDescClean)) {
          return local;
        }
      }
    }
  }

  return null;
}

async function analyzeRemoteImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, info } = await sharp(buffer)
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
        colorBuckets[color] += (s * 2.0);
      }
    }

    let dominantColor = 'grey';
    // If 95% or more of the pixels are grey, the image is classified as grey (monochromatic)
    if (greyCount / pixelCount >= 0.95) {
      dominantColor = 'grey';
    } else {
      // Otherwise, find the dominant color among the non-grey pixels
      let maxWeight = 0;
      for (const [color, weight] of Object.entries(colorBuckets)) {
        if (weight > maxWeight) {
          maxWeight = weight;
          dominantColor = color;
        }
      }
    }

    return dominantColor;
  } catch (err) {
    console.error(`Failed to analyze remote image ${url}:`, err.message);
    return 'grey';
  }
}

async function run() {
  if (!fs.existsSync(PHOTOS_DIR)) {
    console.error(`Error: Photos directory not found at ${PHOTOS_DIR}`);
    return;
  }

  // Load local photos.js list
  if (!fs.existsSync(PHOTOS_FILE)) {
    console.error(`Error: js/data/photos.js not found`);
    return;
  }
  const content = fs.readFileSync(PHOTOS_FILE, 'utf8');
  const startMarker = 'export const photos = [';
  const endMarker = '];';
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.lastIndexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) {
    console.error('Error: Could not locate photos markers in photos.js');
    return;
  }
  const arrayContent = content.substring(startIndex + startMarker.length, endIndex);
  let localPhotos = [];
  try {
    localPhotos = new Function('return [' + arrayContent + ']')();
  } catch (e) {
    console.error('Error parsing photos array from photos.js:', e.message);
    return;
  }

  console.log(`Loaded ${localPhotos.length} photos from local photos.js`);

  // Analyze all local files in photos/
  const files = fs.readdirSync(PHOTOS_DIR).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.webp' || ext === '.jpg' || ext === '.jpeg' || ext === '.png';
  });

  console.log(`Analyzing colors of ${files.length} local images...`);

  const localFileColors = {};

  for (const file of files) {
    const srcPath = `photos/${file}`;


    const fullPath = path.join(PHOTOS_DIR, file);

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
          colorBuckets[color] += (s * 2.0);
        }
      }

      let dominantColor = 'grey';
      if (greyCount / pixelCount >= 0.95) {
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

      localFileColors[srcPath] = dominantColor;
    } catch (err) {
      console.error(`Failed to analyze ${file}:`, err.message);
      localFileColors[srcPath] = 'grey';
    }
  }

  // Fetch production media from API to map production URLs/filenames to analyzed colors
  let livePhotos = [];
  try {
    console.log('Fetching live photos from Cloudflare D1/R2 API...');
    const API_BASE_URL = 'https://vanpics-cms-api.lorzanofrancisevan.workers.dev';
    const res = await fetch(`${API_BASE_URL}/api/photos?limit=500`);
    if (res.ok) {
      const data = await res.json();
      livePhotos = Array.isArray(data) ? data : data.items || [];
      console.log(`Fetched ${livePhotos.length} live photos from API`);
    } else {
      console.warn(`Failed to fetch from API: status ${res.status}`);
    }
  } catch (err) {
    console.warn('Network error fetching live photos:', err.message);
  }

  // Build mapping dictionary
  const finalColorMap = {};
  const finalTitleColorMap = {};

  // 1. Populate from local files analysis
  for (const [src, color] of Object.entries(localFileColors)) {
    finalColorMap[src] = color;
    const filename = path.basename(src);
    finalColorMap[filename] = color;
  }

  // 2. Populate from local photos.js titles
  for (const local of localPhotos) {
    const color = localFileColors[local.src];
    if (color) {
      if (local.title) {
        finalTitleColorMap[local.title.toLowerCase().trim()] = color;
      }
    }
  }

  // 3. Populate from live photos matched to local ones or analyzed remotely
  let matchCount = 0;
  for (const live of livePhotos) {
    const matchedLocal = findLocalMatch(live, localPhotos);
    let color = null;
    if (matchedLocal) {
      color = localFileColors[matchedLocal.src];
      matchCount++;
    } else {
      console.log(`[ANALYZING REMOTE] title: "${live.title}", src: "${live.src}"`);
      color = await analyzeRemoteImage(live.src);
      console.log(`-> Analyzed remote color: ${color}`);
    }

    if (color) {
      finalColorMap[live.src] = color;
      const liveFilename = path.basename(live.src);
      finalColorMap[liveFilename] = color;
      if (live.thumb) {
        finalColorMap[live.thumb] = color;
        finalColorMap[path.basename(live.thumb)] = color;
      }
      if (live.title) {
        finalTitleColorMap[live.title.toLowerCase().trim()] = color;
      }
    }
  }

  console.log(`Successfully matched/analyzed ${livePhotos.length} live photos.`);

  // Write mapping module
  const tsContent = `// Auto-generated by scripts/analyze-colors.js
export const photoColorMap: Record<string, string> = ${JSON.stringify(finalColorMap, null, 2)};

export const photoTitleColorMap: Record<string, string> = ${JSON.stringify(finalTitleColorMap, null, 2)};
`;

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf8');
  console.log(`\nSuccess! Created mapping in ${OUTPUT_FILE}`);
}

run();
