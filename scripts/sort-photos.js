/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PHOTO SORTER UTILITY
 * ─────────────────────────────────────────────────────────────────────────────
 * This script automatically sorts public/data/photos.js by date (newest first).
 * 
 * Logic:
 * 1. Checks 'date' field (e.g., "Oct 19, 2025" or "2023").
 * 2. If 'date' is empty, it uses the file's modification time as a fallback.
 * 3. Undated photos are pushed to the bottom.
 * 
 * Usage: node sort-photos.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

const PHOTOS_FILE = path.join(__dirname, '..', 'public', 'data', 'photos.js');

function getPhotoDate(photo) {
  const dateStr = photo.date ? photo.date.trim().toLowerCase() : '';
  
  if (dateStr) {
    // Try full date: "oct 19, 2025"
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    
    // Try just year: "2023" -> Jan 1 of that year
    if (/^\d{4}$/.test(dateStr)) {
      return new Date(`${dateStr}-01-01`);
    }
  }

  return null; // No valid date
}

function sortPhotos() {
  if (!fs.existsSync(PHOTOS_FILE)) {
    console.error('Error: public/data/photos.js not found!');
    return;
  }

  console.log('Reading public/data/photos.js...');
  const content = fs.readFileSync(PHOTOS_FILE, 'utf8');

  // Extract array using markers
  const startMarker = 'var photos = [';
  const endMarker = '];';
  
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.lastIndexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.error('Error: Could not locate "var photos = [" or "];" markers.');
    return;
  }

  const header = content.substring(0, startIndex + startMarker.length);
  const footer = content.substring(endIndex);
  const arrayContent = content.substring(startIndex + startMarker.length, endIndex);

  // Parse the array safely
  let photos;
  try {
    // We wrap it in brackets to treat it as a literal array
    photos = eval(`[${arrayContent}]`);
  } catch (e) {
    console.error('Error parsing photos array:', e.message);
    return;
  }

  console.log(`Analyzing ${photos.length} photos...`);

  // Sort Logic:
  // 1. Photos with dates come first (sorted newest to oldest)
  // 2. Photos without dates go to bottom (sorted alphabetically by src)
  photos.sort((a, b) => {
    const dateA = getPhotoDate(a);
    const dateB = getPhotoDate(b);

    if (dateA && dateB) {
      return dateB - dateA; // Newest first
    }
    
    if (dateA) return -1; // A has date, B doesn't -> A comes first
    if (dateB) return 1;  // B has date, A doesn't -> B comes first

    // Both have no date -> alphabetical sort by src
    return a.src.localeCompare(b.src);
  });

  // Re-generate the array content with clean formatting
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
  console.log('Done! public/data/photos.js has been sorted by date.');
}

sortPhotos();
