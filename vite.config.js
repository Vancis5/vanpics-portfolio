export default {
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    target: ['chrome100', 'safari15', 'firefox100', 'edge100']
  }
};
