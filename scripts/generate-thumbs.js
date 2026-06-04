const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = './photos';
const thumbDir = './photos/thumbs';
const miniDir = './photos/mini';
const blurDir = './photos/blur';

// Create directories if they don't exist
[thumbDir, miniDir, blurDir].forEach(dir => {
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
        const miniPath = path.join(miniDir, photo);
        const blurPath = path.join(blurDir, photo);

        try {
            // 1. Generate Thumbnail (600px)
            await sharp(inputPath)
                .resize(600)
                .webp({ quality: 70 })
                .toFile(thumbPath);

            // 2. Generate Mini Thumbnail (120px) for filmstrip
            await sharp(inputPath)
                .resize(120)
                .webp({ quality: 75 })
                .toFile(miniPath);

            // 3. Generate PRE-BLURRED background (40px wide + heavy blur)
            // This relieves the browser from doing any CSS filter math
            await sharp(inputPath)
                .resize(40) 
                .blur(10) // Small radius on a small image = huge blur effect
                .webp({ quality: 40 })
                .toFile(blurPath);

            count++;
            if (count % 20 === 0) console.log(`Processed ${count}/${photos.length}...`);
        } catch (err) {
            console.error(`Error processing ${photo}:`, err.message);
        }
    }

    console.log('--- DONE ---');
    console.log(`Successfully generated ${count} thumbnails, mini thumbnails, and blurred assets.`);
}

processPhotos();
