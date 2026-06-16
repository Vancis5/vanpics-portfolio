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
            let img = sharp(inputPath);
            const metadata = await img.metadata();
            const originalWidth = metadata.width || 1920;
            const scaledBlur = Math.round(50 * (originalWidth / 1920));

            // 1. Blur first at native resolution so highlights bleed naturally
            img = img.blur(scaledBlur);

            // 2. Resize to 1200px for clean, banding-free gradients
            img = img.resize(1200, null, { withoutEnlargement: true });

            // 3. Enforce minimum average brightness of 70 so dark photos show details
            const stats = await img.stats();
            const avg = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
            if (avg < 70) {
                const offset = 20;
                const scale = (70 - offset) / avg;
                img = img.linear(scale, offset);
            }

            // 4. Bake in the equivalent of CSS brightness(0.22) and saturate(0.65)
            await img
                .modulate({
                    brightness: 0.22,
                    saturation: 0.65
                })
                .webp({ quality: 90 })
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
