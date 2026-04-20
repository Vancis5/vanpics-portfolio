const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = './photos';
const outputDir = './photos/thumbs';

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('Created directory:', outputDir);
}

async function processPhotos() {
    const files = fs.readdirSync(inputDir);
    const photos = files.filter(file => /\.(webp|jpg|jpeg|png)$/i.test(file));

    console.log(`Found ${photos.length} photos to process...`);

    let count = 0;
    for (const photo of photos) {
        const inputPath = path.join(inputDir, photo);
        const outputPath = path.join(outputDir, photo);

        try {
            // Check if thumb already exists to skip (optional)
            // if (fs.existsSync(outputPath)) continue;

            await sharp(inputPath)
                .resize(600) // 600px width is usually plenty for thumbnails
                .webp({ quality: 70 }) // lower quality for thumbnails
                .toFile(outputPath);

            count++;
            if (count % 20 === 0) console.log(`Processed ${count}/${photos.length}...`);
        } catch (err) {
            console.error(`Error processing ${photo}:`, err.message);
        }
    }

    console.log('--- DONE ---');
    console.log(`Successfully generated ${count} thumbnails in ${outputDir}`);
}

processPhotos();
