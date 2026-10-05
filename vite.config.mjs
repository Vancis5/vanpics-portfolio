import fs from 'fs';
import path from 'path';

export default {
  server: {
    host: true,
    port: 5199,
    allowedHosts: true,
    headers: {
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  },
  preview: {
    headers: {
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    target: 'es2022',
    sourcemap: true,
    // Never inline CSS as data: URIs. The CSP has no `data:` in style-src, so Vite's default
    // inlining of small stylesheets (css/motion-section.css) was blocked on the live site.
    assetsInlineLimit: (file) => (file.endsWith('.css') ? false : undefined),
    rollupOptions: {
      input: {
        main: path.resolve('index.html'),
        admin: path.resolve('admin.html'),
        login: path.resolve('login.html'),
        googleVerification: path.resolve('google5d62f08d6e05793e.html')
      }
    }
  },
  plugins: [
    {
      name: 'copy-assets-plugin',
      closeBundle() {
        const srcIcons = path.resolve('icons');
        const destIcons = path.resolve('dist/icons');
        const srcPreview = path.resolve('preview.jpg');
        const destPreview = path.resolve('dist/preview.jpg');

        try {

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
        } catch (err) {
          console.error('❌ [Vite Plugin] Error copying assets to dist:', err);
        }
      }
    }
  ]
};
