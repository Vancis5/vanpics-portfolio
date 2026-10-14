export function resizeImage(
  img: HTMLImageElement | HTMLCanvasElement,
  maxDimension: number,
  quality: number,
  applyBlur = false
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
    
    let width = img instanceof HTMLImageElement ? img.width : (img as HTMLCanvasElement).width;
    let height = img instanceof HTMLImageElement ? img.height : (img as HTMLCanvasElement).height;
    
    if (width > height) {
      if (width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      }
    } else {
      if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    if (applyBlur) {
      ctx.filter = 'blur(10px)';
      ctx.drawImage(img, -10, -10, width + 20, height + 20);
    } else {
      ctx.drawImage(img, 0, 0, width, height);
    }
    
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      resolve(blob);
    }, 'image/webp', quality);
  });
}
