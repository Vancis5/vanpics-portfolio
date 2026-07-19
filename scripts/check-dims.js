const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../photos-raw');
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

  async function check() {
    for (const f of files) {
      const meta = await sharp(path.join(dir, f)).metadata();
      console.log(`${f}: ${meta.width}x${meta.height}`);
    }
  }

  check();
} else {
  console.log(`Directory ${dir} does not exist`);
}
