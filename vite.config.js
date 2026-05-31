import fs from 'fs';
import path from 'path';

export default {
  server: {
    host: true,
    port: 5173
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    target: ['chrome100', 'safari15', 'firefox100', 'edge100'],
    rollupOptions: {
      input: {
        main: path.resolve('index.html'),
        admin: path.resolve('admin.html'),
        login: path.resolve('login.html')
      }
    }
  },
  plugins: [
    {
      name: 'copy-assets-plugin',
      closeBundle() {
        const srcPhotos = path.resolve('photos');
        const destPhotos = path.resolve('dist/photos');
        const srcIcons = path.resolve('icons');
        const destIcons = path.resolve('dist/icons');
        const srcPreview = path.resolve('preview.jpg');
        const destPreview = path.resolve('dist/preview.jpg');
        const srcAdminJs = path.resolve('js/admin.js');
        const destAdminJs = path.resolve('dist/js/admin.js');
        const srcLoginJs = path.resolve('js/login.js');
        const destLoginJs = path.resolve('dist/js/login.js');

        try {
          if (fs.existsSync(srcPhotos)) {
            console.log('📸 [Vite Plugin] Copying photos to dist...');
            fs.cpSync(srcPhotos, destPhotos, { recursive: true });
            console.log('   ✅ Photos copied successfully!');
          } else {
            console.warn('   ⚠️ Photos directory not found at:', srcPhotos);
          }

          if (fs.existsSync(srcIcons)) {
            console.log('✨ [Vite Plugin] Copying icons to dist...');
            fs.cpSync(srcIcons, destIcons, { recursive: true });
            console.log('   ✅ Icons copied successfully!');
          } else {
            console.warn('   ⚠️ Icons directory not found at:', srcIcons);
          }

          if (fs.existsSync(srcPreview)) {
            console.log('🖼️ [Vite Plugin] Copying preview.jpg to dist...');
            fs.copyFileSync(srcPreview, destPreview);
            console.log('   ✅ preview.jpg copied successfully!');
          } else {
            console.warn('   ⚠️ preview.jpg not found at:', srcPreview);
          }

          if (fs.existsSync(srcAdminJs)) {
            console.log('⚙️ [Vite Plugin] Copying admin.js to dist/js/...');
            fs.mkdirSync(path.resolve('dist/js'), { recursive: true });
            fs.copyFileSync(srcAdminJs, destAdminJs);
            console.log('   ✅ admin.js copied successfully!');
          } else {
            console.warn('   ⚠️ admin.js not found at:', srcAdminJs);
          }

          if (fs.existsSync(srcLoginJs)) {
            console.log('⚙️ [Vite Plugin] Copying login.js to dist/js/...');
            fs.mkdirSync(path.resolve('dist/js'), { recursive: true });
            fs.copyFileSync(srcLoginJs, destLoginJs);
            console.log('   ✅ login.js copied successfully!');
          } else {
            console.warn('   ⚠️ login.js not found at:', srcLoginJs);
          }
        } catch (err) {
          console.error('❌ [Vite Plugin] Error copying assets to dist:', err);
        }
      }
    }
  ]
};
