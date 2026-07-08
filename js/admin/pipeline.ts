export function resizeImage(img, maxDimension, quality, applyBlur = false) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let width = img.width;
    let height = img.height;
    
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
      resolve(blob);
    }, 'image/webp', quality);
  });
}
