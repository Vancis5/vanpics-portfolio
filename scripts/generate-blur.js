/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BLUR GENERATOR UTILITY
 * ─────────────────────────────────────────────────────────────────────────────
 * This script generates ultra-low-res, heavily blurred images for the
 * lightbox background. 
 *
 * Why: 40px wide images that are already blurred in the file are 100x faster 
 * for the browser to render than applying a 50px CSS blur filter in real-time.
 * 
 * Usage: node scripts/generate-blur.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '..', 'photos');
const blurDir = path.join(__dirname, '..', 'photos', 'blur');

// Create directory if it doesn't exist
if (!fs.existsSync(blurDir)) {
    fs.mkdirSync(blurDir, { recursive: true });
    console.log('Created directory:', blurDir);
}

async function processPhotos() {
    const files = fs.readdirSync(inputDir);
    const photos = files.filter(file => /\.(webp|jpg|jpeg|png)$/i.test(file));

    console.log(`Found ${photos.length} photos to process...`);

    let count = 0;
    for (const photo of photos) {
        const inputPath = path.join(inputDir, photo);
        const blurPath = path.join(blurDir, photo);

        try {
            // Generate PRE-BLURRED background (40px wide + heavy blur)
            // This relieves the browser from doing any CSS filter math
            await sharp(inputPath)
                .resize(40) 
                .blur(10) // Small radius on a small image = massive blur effect
                .webp({ quality: 40 })
                .toFile(blurPath);

            count++;
            if (count % 20 === 0) console.log(`Processed ${count}/${photos.length}...`);
        } catch (err) {
            console.error(`Error processing ${photo}: ${err.message}`);
        }
    }

    console.log('--- DONE ---');
    console.log(`Successfully generated ${count} blurred assets in ${blurDir}`);
}

processPhotos();
