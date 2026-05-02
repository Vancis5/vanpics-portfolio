const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '..', 'photos-raw');
const outputDir = path.join(__dirname, '..', 'photos');

async function processRaw() {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = fs.readdirSync(inputDir);
    const photos = files.filter(file => /\.(webp|jpg|jpeg|png)$/i.test(file));

    console.log(`🚀 Found ${photos.length} raw photos to process...`);

    for (const photo of photos) {
        const inputPath = path.join(inputDir, photo);
        const fileName = path.parse(photo).name;
        const outputPath = path.join(outputDir, `${fileName}.webp`);

        try {
            await sharp(inputPath)
                .resize(2500, 2500, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality: 70 })
                .toFile(outputPath);
            
            console.log(`✅ Processed: ${photo} -> ${fileName}.webp`);
        } catch (err) {
            console.error(`❌ Error processing ${photo}:`, err.message);
        }
    }

    console.log('\n✨ All raw photos processed to .webp with 70 quality.');
}

processRaw();
