const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = './photos';
const thumbDir = './photos/thumbs';
const blurDir = './photos/blur';

// Create directories if they don't exist
[thumbDir, blurDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('Created directory:', dir);
    }
});

async function processPhotos() {
    const files = fs.readdirSync(inputDir);
    const photos = files.filter(file => /\.(webp|jpg|jpeg|png)$/i.test(file));

    console.log(`Found ${photos.length} photos to process...`);

    let count = 0;
    for (const photo of photos) {
        const inputPath = path.join(inputDir, photo);
        const thumbPath = path.join(thumbDir, photo);
        const blurPath = path.join(blurDir, photo);

        try {
            // 1. Generate Thumbnail (600px)
            await sharp(inputPath)
                .resize(600)
                .webp({ quality: 70 })
                .toFile(thumbPath);

            // 2. Generate PRE-BLURRED background (40px wide + heavy blur)
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
    console.log(`Successfully generated ${count} thumbnails and blurred assets.`);
}

processPhotos();
