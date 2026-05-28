const fs = require('fs');
const path = require('path');

const srcPhotos = path.join(__dirname, '..', 'photos');
const destPhotos = path.join(__dirname, '..', 'dist', 'photos');

const srcIcons = path.join(__dirname, '..', 'icons');
const destIcons = path.join(__dirname, '..', 'dist', 'icons');

const srcPreview = path.join(__dirname, '..', 'preview.jpg');
const destPreview = path.join(__dirname, '..', 'dist', 'preview.jpg');

try {
    if (fs.existsSync(srcPhotos)) {
        console.log('📸 Copying photos to dist...');
        fs.cpSync(srcPhotos, destPhotos, { recursive: true });
        console.log('   ✅ Photos copied successfully!');
    } else {
        console.warn('   ⚠️ Photos directory not found at:', srcPhotos);
    }

    if (fs.existsSync(srcIcons)) {
        console.log('✨ Copying icons to dist...');
        fs.cpSync(srcIcons, destIcons, { recursive: true });
        console.log('   ✅ Icons copied successfully!');
    } else {
        console.warn('   ⚠️ Icons directory not found at:', srcIcons);
    }

    if (fs.existsSync(srcPreview)) {
        console.log('🖼️ Copying preview.jpg to dist...');
        fs.copyFileSync(srcPreview, destPreview);
        console.log('   ✅ preview.jpg copied successfully!');
    } else {
        console.warn('   ⚠️ preview.jpg not found at:', srcPreview);
    }
} catch (err) {
    console.error('❌ Error copying assets to dist:', err);
    process.exit(1);
}
