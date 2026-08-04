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
        const safeFile = path.basename(file);
        const fullPath = path.join(inputDir, safeFile);
        return fs.statSync(fullPath).isFile() && /\.(webp|jpg|jpeg|png)$/i.test(safeFile);
    });

    console.log(`Found ${photos.length} photos to process...`);

    let count = 0;
    for (const photo of photos) {
        const safePhoto = path.basename(photo);
        const inputPath = path.join(inputDir, safePhoto);
        const thumbPath = path.join(thumbDir, safePhoto);

        try {
            await sharp(inputPath)
                .resize(600)
                .webp({ quality: 70 })
                .toFile(thumbPath);

            count++;
            if (count % 20 === 0) console.log(`Processed ${count}/${photos.length}...`);
        } catch (err) {
            console.error('Error processing %s:', photo, err.message);
        }
    }

    console.log('--- DONE ---');
    console.log(`Successfully generated ${count} thumbnails.`);
}

processPhotos();
