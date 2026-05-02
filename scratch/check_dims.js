const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = './photos-raw';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));

async function check() {
    for (const f of files) {
        const meta = await sharp(path.join(dir, f)).metadata();
        console.log(`${f}: ${meta.width}x${meta.height}`);
    }
}

check();
