const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = './photos';
const thumbDir = './photos/thumbs';

// Create directories if they don't exist
[thumbDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('Created directory:', dir);
    }
});

async function processPhotos() {
    const files = fs.readdirSync(inputDir);
    const photos = files.filter(file => {
        const fullPath = path.join(inputDir, file);
        return fs.statSync(fullPath).isFile() && /\.(webp|jpg|jpeg|png)$/i.test(file);
    });

    console.log(`Found ${photos.length} photos to process...`);

    let count = 0;
    for (const photo of photos) {
        const inputPath = path.join(inputDir, photo);
        const thumbPath = path.join(thumbDir, photo);

        try {
            await sharp(inputPath)
                .resize(600)
                .webp({ quality: 70 })
                .toFile(thumbPath);

            count++;
            if (count % 20 === 0) console.log(`Processed ${count}/${photos.length}...`);
        } catch (err) {
            console.error(`Error processing ${photo}:`, err.message);
        }
    }

    console.log('--- DONE ---');
    console.log(`Successfully generated ${count} thumbnails.`);
}

processPhotos();
