import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const BUCKET_NAME = 'vanpics-media';
const MAX_CONCURRENT_UPLOADS = 8;

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function uploadFileWithRetry(localPath, r2Key, retries = 3) {
  const normalizedPath = path.resolve(localPath);
  if (!fs.existsSync(normalizedPath)) {
    console.warn(`⚠️ Local file not found, skipping: ${localPath}`);
    return;
  }

  // Use wrangler r2 object put <bucket>/<key> --file <local-path> --remote
  const command = `npx wrangler r2 object put "${BUCKET_NAME}/${r2Key}" --file="${normalizedPath}" --remote`;
  
  for (let i = 0; i < retries; i++) {
    try {
      await runCommand(command);
      console.log(`✅ [SUCCESS] ${r2Key}`);
      return;
    } catch (err) {
      if (i === retries - 1) {
        console.error(`❌ [FAILED] ${r2Key} after ${retries} attempts:`, err.message);
        throw err;
      }
      console.warn(`⚠️ [RETRYING ${i + 1}/${retries}] ${r2Key}`);
    }
  }
}

async function main() {
  console.log(`Starting highly concurrent bulk migration to Cloudflare R2 bucket: ${BUCKET_NAME}...\n`);

  const photosDir = path.resolve('photos');
  const thumbsDir = path.resolve('photos/thumbs');
  const blurDir = path.resolve('photos/blur');

  const uploadQueue = [];

  // 1. Queue original photos
  if (fs.existsSync(photosDir)) {
    const files = fs.readdirSync(photosDir);
    for (const file of files) {
      const fullPath = path.join(photosDir, file);
      if (fs.statSync(fullPath).isFile() && file.endsWith('.webp')) {
        uploadQueue.push({ localPath: fullPath, r2Key: `photos/${file}` });
      }
    }
  }

  // 2. Queue thumbnails & video posters
  if (fs.existsSync(thumbsDir)) {
    const files = fs.readdirSync(thumbsDir);
    for (const file of files) {
      const fullPath = path.join(thumbsDir, file);
      if (fs.statSync(fullPath).isFile() && file.endsWith('.webp')) {
        if (file === 'after-hours.webp') {
          uploadQueue.push({ localPath: fullPath, r2Key: `posters/${file}` });
        } else {
          uploadQueue.push({ localPath: fullPath, r2Key: `thumbs/${file}` });
        }
      }
    }
  }

  // 3. Queue blurs
  if (fs.existsSync(blurDir)) {
    const files = fs.readdirSync(blurDir);
    for (const file of files) {
      const fullPath = path.join(blurDir, file);
      if (fs.statSync(fullPath).isFile() && file.endsWith('.webp')) {
        uploadQueue.push({ localPath: fullPath, r2Key: `blur/${file}` });
      }
    }
  }

  console.log(`Total files queued for upload: ${uploadQueue.length}\n`);

  // Active pool processing loop
  const activeWorkers = [];
  const results = [];

  async function worker() {
    while (uploadQueue.length > 0) {
      const { localPath, r2Key } = uploadQueue.shift();
      console.log(`🚀 [STARTING] ${r2Key} (remaining queue: ${uploadQueue.length})`);
      try {
        await uploadFileWithRetry(localPath, r2Key);
        results.push({ r2Key, success: true });
      } catch (err) {
        results.push({ r2Key, success: false, error: err.message });
      }
    }
  }

  // Spawn initial workers
  for (let i = 0; i < Math.min(MAX_CONCURRENT_UPLOADS, uploadQueue.length); i++) {
    activeWorkers.push(worker());
  }

  await Promise.all(activeWorkers);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n✨ Migration report:`);
  console.log(`   - Successful uploads: ${successful}`);
  console.log(`   - Failed uploads: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
