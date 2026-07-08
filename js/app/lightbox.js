import { domRefs } from './dom.js';
import { state } from './state.js';
import { getCategorySlug, motionProjects } from './media-data.js';
import { getVideoPlayerMarkup } from './motion-markup.js';
import { slugify } from './utils.js';
import { hideFilmstripIfReady, showFilmstripIfReady, clearFilmstripHideTimerIfReady, setFilmstripLiftZoneDisplay } from './core.js';
import { resetZoom } from './lightbox-zoom.js';
import { updateFilmstrip } from './filmstrip.js';

let blurToken = 0;
let blurPreloadTimer = null;
let mobileScrollToSlideCallback = null;
let photoPlaceholderTimer = null;
let photoPlaceholderToken = 0;
let swipeNeighborsCallback = null;
let previouslyFocusedElement = null;

// In-memory decoded image cache — prevents placeholder flash on revisited photos
const _imgCache = new Map();
const _IMG_CACHE_MAX = 30;

function _cacheImage(src) {
  if (!src) return null;
  if (_imgCache.has(src)) return _imgCache.get(src);
  if (_imgCache.size >= _IMG_CACHE_MAX) _imgCache.delete(_imgCache.keys().next().value); // evict oldest
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const entry = {
    img,
    decoded: false,
    decodePromise: null
  };
  entry.decodePromise = new Promise(resolve => {
    function markDecoded() {
      if (img.decode) {
        img.decode().then(function () {
          entry.decoded = true;
          resolve(entry);
        }).catch(function () {
          resolve(entry);
        });
      } else {
        entry.decoded = true;
        resolve(entry);
      }
    }

    img.onload = markDecoded;
    img.onerror = function () { resolve(entry); };
    img.src = src;
    if (img.complete && img.naturalWidth > 0) markDecoded();
  });
  _imgCache.set(src, entry);
  return entry;
}

function getLightboxBlurPath(src) {
  if (!src) return '';
  if (src.includes('photos/') && !src.includes('photos/thumbs/')) {
    return src.replace('photos/', 'photos/thumbs/');
  }
  return src;
}

function getCachedImageDecode(src) {
  let cached = _cacheImage(src);
  if (!cached) return Promise.resolve(null);
  if (cached.decoded) return Promise.resolve(cached);
  return cached.decodePromise || Promise.resolve(cached);
}

export function preloadLightboxBlurNeighbors(centerIndex, range) {
  if (state.currentLightboxIsMotion) return;

  let currentSet = getCurrentLightboxItems();
  let len = currentSet.length;
  if (!len) return;

  let preloadRange = Number.isFinite(range) ? range : 6;
  for (let offset = -preloadRange; offset <= preloadRange; offset++) {
    let p = currentSet[(centerIndex + offset + len) % len];
    if (!p) continue;
    let bSrc = p.thumb || p.src;
    if (bSrc) _cacheImage(getLightboxBlurPath(bSrc));
  }
}

function scheduleLightboxBlurNeighborPreload(centerIndex, delay) {
  if (blurPreloadTimer) {
    clearTimeout(blurPreloadTimer);
    blurPreloadTimer = null;
  }
  blurPreloadTimer = setTimeout(function () {
    blurPreloadTimer = null;
    if (state.currentLightboxIsMotion || state.cur !== centerIndex) return;
    preloadLightboxBlurNeighbors(centerIndex, 6);
  }, delay || 0);
}

export function setMobileScrollToSlideCallback(callback) {
  mobileScrollToSlideCallback = typeof callback === 'function' ? callback : null;
}

function refreshLightboxInfoRefs() {
  let info = domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') : null;
  if (!info) return null;

  domRefs.lightboxInfo = info;
  domRefs.lightboxTitle = info.querySelector('#lightbox-title');
  domRefs.lightboxDescToggle = info.querySelector('#lightbox-desc-toggle');
  domRefs.lightboxDesc = info.querySelector('#lightbox-desc');
  domRefs.metaLocation = info.querySelector('#meta-location');
  domRefs.metaLocationText = info.querySelector('#meta-location-text');
  domRefs.metaDate = info.querySelector('#meta-date');
  domRefs.metaDateText = info.querySelector('#meta-date-text');
  domRefs.metaMusic = info.querySelector('#meta-music');
  domRefs.metaMusicText = info.querySelector('#meta-music-text');
  return info;
}

let blurRenderer = null;

class WebGLBlurRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false
    });
    if (!this.gl) {
      console.warn('WebGL context creation failed');
      return;
    }

    this.width = 256;
    this.height = 256;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.startTime = performance.now();
    this.animating = false;
    this.mixFactor = 1.0;
    this.transitionSpeed = 0.035;
    this.animationId = null;

    this.dirPrev = 1.0;
    this.dirCurr = 1.0;

    this.textures = {
      prev: null,
      current: null
    };

    this.initShaders();
    this.initBuffers();
    this.initFramebuffers();
    this.initDummyTextures();
  }

  initShaders() {
    const VS_SOURCE = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const FS_LIQUID = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture_prev;
      uniform sampler2D u_texture;
      uniform float u_mix;
      uniform float u_time;
      uniform float u_dir_prev;
      uniform float u_dir_curr;

      vec2 transformUV(vec2 uv, float angle, float scale, vec2 translation) {
        vec2 p = uv - 0.5;
        p -= translation;
        float s = sin(angle);
        float c = cos(angle);
        p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        p /= scale;
        return p + 0.5;
      }

      vec3 blendScreen(vec3 base, vec3 blend) {
        return 1.0 - (1.0 - base) * (1.0 - blend);
      }

      float blendOverlay(float base, float blend) {
        return base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
      }
      vec3 blendOverlay(vec3 base, vec3 blend) {
        return vec3(blendOverlay(base.r, blend.r), blendOverlay(base.g, blend.g), blendOverlay(base.b, blend.b));
      }

      vec4 sampleLiquid(sampler2D tex, vec2 uv, float dir) {
        // Base Layer (45s linear loop)
        float k0 = fract(u_time / 45.0);
        float angle0 = dir * k0 * 2.0 * 3.14159265;
        float scale0 = mix(1.2, 1.35, 0.5 - 0.5 * cos(k0 * 2.0 * 3.14159265));
        vec2 trans0 = mix(vec2(0.0, 0.0), vec2(-0.03, 0.02), 0.5 - 0.5 * cos(k0 * 2.0 * 3.14159265));
        vec2 uv0 = transformUV(uv, angle0, scale0, trans0);
        vec4 baseColor = texture2D(tex, clamp(uv0, 0.0, 1.0));

        // Twist 1 Layer (32s ease-in-out alternate)
        float k1 = 0.5 - 0.5 * cos(u_time * 2.0 * 3.14159265 / 64.0);
        float angle1 = dir * (2.0 * 3.14159265) * (1.0 - k1);
        float scale1 = mix(1.4, 1.15, 0.5 - 0.5 * cos(k1 * 2.0 * 3.14159265));
        vec2 trans1 = mix(vec2(0.02, -0.03), vec2(-0.04, 0.04), 0.5 - 0.5 * cos(k1 * 2.0 * 3.14159265));
        vec2 uv1 = transformUV(uv, angle1, scale1, trans1);
        vec4 twist1Color = texture2D(tex, clamp(uv1, 0.0, 1.0));
        vec3 col = mix(baseColor.rgb, blendScreen(baseColor.rgb, twist1Color.rgb), 0.45);

        // Twist 2 Layer (24s ease-in-out alternate-reverse)
        float k2 = 0.5 + 0.5 * cos(u_time * 2.0 * 3.14159265 / 48.0);
        float angle2 = dir * (3.14159265 / 4.0 + (0.5 - 0.5 * cos(k2 * 2.0 * 3.14159265)) * (3.14159265 * 0.5));
        float scale2 = mix(1.1, 1.5, 0.5 - 0.5 * cos(k2 * 2.0 * 3.14159265));
        vec2 trans2 = mix(vec2(-0.05, -0.05), vec2(0.04, 0.04), 0.5 - 0.5 * cos(k2 * 2.0 * 3.14159265));
        vec2 uv2 = transformUV(uv, angle2, scale2, trans2);
        vec4 twist2Color = texture2D(tex, clamp(uv2, 0.0, 1.0));
        col = mix(col, blendOverlay(col, twist2Color.rgb), 0.35);

        return vec4(col, 1.0);
      }

      void main() {
        vec4 col_prev = sampleLiquid(u_texture_prev, v_texCoord, u_dir_prev);
        vec4 col_curr = sampleLiquid(u_texture, v_texCoord, u_dir_curr);
        vec3 blended = mix(col_prev.rgb, col_curr.rgb, u_mix);

        // Saturation (1.8) & Brightness (0.24) adjustments
        float luma = dot(blended, vec3(0.299, 0.587, 0.114));
        vec3 sat = mix(vec3(luma), blended, 1.8);
        gl_FragColor = vec4(sat * 0.24, 1.0);
      }
    `;

    const FS_DOWN = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      uniform vec2 u_halfPixel;
      uniform float u_offset;

      void main() {
        vec2 uv = v_texCoord;
        vec2 d = u_halfPixel * u_offset;

        vec4 sum = texture2D(u_texture, uv) * 4.0;
        sum += texture2D(u_texture, uv - d);
        sum += texture2D(u_texture, uv + d);
        sum += texture2D(u_texture, uv + vec2(d.x, -d.y));
        sum += texture2D(u_texture, uv + vec2(-d.x, d.y));

        gl_FragColor = sum / 8.0;
      }
    `;

    const FS_UP = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      uniform vec2 u_halfPixel;
      uniform float u_offset;

      void main() {
        vec2 uv = v_texCoord;
        vec2 d = u_halfPixel * u_offset;

        vec4 sum = vec4(0.0);
        sum += texture2D(u_texture, uv + vec2(-d.x * 2.0, 0.0)) * 2.0;
        sum += texture2D(u_texture, uv + vec2(0.0, -d.y * 2.0)) * 2.0;
        sum += texture2D(u_texture, uv + vec2(d.x * 2.0, 0.0)) * 2.0;
        sum += texture2D(u_texture, uv + vec2(0.0, d.y * 2.0)) * 2.0;

        sum += texture2D(u_texture, uv + d * vec2(-1.0, -1.0));
        sum += texture2D(u_texture, uv + d * vec2(1.0, -1.0));
        sum += texture2D(u_texture, uv + d * vec2(1.0, 1.0));
        sum += texture2D(u_texture, uv + d * vec2(-1.0, 1.0));

        gl_FragColor = sum / 12.0;
      }
    `;

    this.progLiquid = this.createProgram(VS_SOURCE, FS_LIQUID);
    this.progDown = this.createProgram(VS_SOURCE, FS_DOWN);
    this.progUp = this.createProgram(VS_SOURCE, FS_UP);
  }

  compileShader(source, type) {
    let gl = this.gl;
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile log:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  createProgram(vsSource, fsSource) {
    let gl = this.gl;
    let vs = this.compileShader(vsSource, gl.VERTEX_SHADER);
    let fs = this.compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    let program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  initBuffers() {
    let gl = this.gl;
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0
    ]), gl.STATIC_DRAW);
  }

  createFramebuffer(w, h) {
    let gl = this.gl;
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    return { fbo, texture, w, h };
  }

  initFramebuffers() {
    this.fbos = [
      this.createFramebuffer(256, 256), // fbos[0]: liquid pass
      this.createFramebuffer(128, 128), // fbos[1]: down 1
      this.createFramebuffer(64, 64),   // fbos[2]: down 2
      this.createFramebuffer(128, 128)  // fbos[3]: up 1
    ];
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  initDummyTextures() {
    let gl = this.gl;
    let dummy = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, dummy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.dummyTexture = dummy;
  }

  createWebGLTexture(img) {
    let gl = this.gl;
    if (!gl) return null;
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }

  setImage(img) {
    let gl = this.gl;
    if (!gl) return;

    if (this.textures.current) {
      if (this.textures.prev && this.textures.prev !== this.dummyTexture) {
        gl.deleteTexture(this.textures.prev);
      }
      this.textures.prev = this.textures.current;
      this.dirPrev = this.dirCurr;
    } else {
      this.textures.prev = this.dummyTexture;
      this.dirPrev = 1.0;
    }

    this.textures.current = this.createWebGLTexture(img);
    this.dirCurr = Math.random() > 0.5 ? 1.0 : -1.0;
    this.mixFactor = 0.0;
    this.startAnimation();
  }

  fadeToBlack() {
    let gl = this.gl;
    if (!gl) return;

    if (this.textures.current) {
      if (this.textures.prev && this.textures.prev !== this.dummyTexture) {
        gl.deleteTexture(this.textures.prev);
      }
      this.textures.prev = this.textures.current;
      this.dirPrev = this.dirCurr;
    } else {
      this.textures.prev = this.dummyTexture;
      this.dirPrev = 1.0;
    }

    this.textures.current = this.dummyTexture;
    this.dirCurr = 1.0;
    this.mixFactor = 0.0;
    this.startAnimation();
  }

  startAnimation() {
    if (this.animating) return;
    this.animating = true;
    this.render();
  }

  stopAnimation() {
    this.animating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  render() {
    if (!this.gl) return;
    let gl = this.gl;

    let elapsedSeconds = (performance.now() - this.startTime) / 1000.0;
    if (this.mixFactor < 1.0) {
      this.mixFactor = Math.min(1.0, this.mixFactor + this.transitionSpeed);
    }

    let positionLocation = gl.getAttribLocation(this.progLiquid, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // PASS 1: Liquid simulation (FBO 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[0].fbo);
    gl.viewport(0, 0, this.fbos[0].w, this.fbos[0].h);
    gl.useProgram(this.progLiquid);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.prev || this.dummyTexture);
    gl.uniform1i(gl.getUniformLocation(this.progLiquid, 'u_texture_prev'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.current || this.dummyTexture);
    gl.uniform1i(gl.getUniformLocation(this.progLiquid, 'u_texture'), 1);

    gl.uniform1f(gl.getUniformLocation(this.progLiquid, 'u_mix'), this.mixFactor);
    gl.uniform1f(gl.getUniformLocation(this.progLiquid, 'u_time'), elapsedSeconds);
    gl.uniform1f(gl.getUniformLocation(this.progLiquid, 'u_dir_prev'), this.dirPrev);
    gl.uniform1f(gl.getUniformLocation(this.progLiquid, 'u_dir_curr'), this.dirCurr);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // PASS 2: Downsample 1
    this.runBlurPass(this.progDown, this.fbos[0].texture, this.fbos[1], 1.0);

    // PASS 3: Downsample 2
    this.runBlurPass(this.progDown, this.fbos[1].texture, this.fbos[2], 1.0);

    // PASS 4: Upsample 1
    this.runBlurPass(this.progUp, this.fbos[2].texture, this.fbos[3], 2.0);

    // PASS 5: Upsample 2 (to screen)
    this.runBlurPass(this.progUp, this.fbos[3].texture, null, 2.0);

    if (this.animating) {
      this.animationId = requestAnimationFrame(() => this.render());
    }
  }

  runBlurPass(program, inputTexture, outputFbo, offset) {
    let gl = this.gl;
    gl.useProgram(program);

    if (outputFbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo.fbo);
      gl.viewport(0, 0, outputFbo.w, outputFbo.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

    let inputWidth = 256;
    let inputHeight = 256;
    if (program === this.progDown) {
      if (outputFbo.w === 128) { inputWidth = 256; inputHeight = 256; }
      else if (outputFbo.w === 64) { inputWidth = 128; inputHeight = 128; }
    } else {
      if (!outputFbo) { inputWidth = 128; inputHeight = 128; }
      else if (outputFbo.w === 128) { inputWidth = 64; inputHeight = 64; }
    }

    gl.uniform2f(gl.getUniformLocation(program, 'u_halfPixel'), 1.0 / (2.0 * inputWidth), 1.0 / (2.0 * inputHeight));
    gl.uniform1f(gl.getUniformLocation(program, 'u_offset'), offset);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

function initBlurRenderer() {
  if (blurRenderer) return;
  let canvas = domRefs.blurCanvas;
  if (!canvas) return;
  blurRenderer = new WebGLBlurRenderer(canvas);
}

export function setLightboxBlur(src) {
  if (!src) return;

  initBlurRenderer();
  let blurPath = getLightboxBlurPath(src);
  let token = ++blurToken;

  let cached = _cacheImage(blurPath);

  function fadeToBlackFallback() {
    if (blurRenderer) {
      blurRenderer.fadeToBlack();
    }
  }

  function doSwap() {
    if (token !== blurToken) return;

    if (blurRenderer && cached && cached.img) {
      blurRenderer.setImage(cached.img);
    }
    
    if (domRefs.blurCanvas) {
      domRefs.blurCanvas.classList.add('active');
    }
  }

  if (cached && cached.decoded) {
    doSwap();
    return;
  }

  let timer = setTimeout(function () {
    if (token === blurToken) {
      fadeToBlackFallback();
    }
  }, 50);

  let decodePromise = cached && cached.decodePromise ? cached.decodePromise : getCachedImageDecode(blurPath);
  decodePromise.then(function () {
    if (token !== blurToken) return;
    clearTimeout(timer);
    doSwap();
  });
}

function clearLightboxPhotoPlaceholder(expectedToken) {
  if (expectedToken && expectedToken !== photoPlaceholderToken) return;
  if (!expectedToken) photoPlaceholderToken++;
  let wrap = domRefs.lightboxImgWrap;
  let img = domRefs.lightboxImg;
  if (!wrap) return;
  wrap.classList.remove('photo-error');
  wrap.classList.add('photo-loaded');
  if (img) img.removeAttribute('data-loading-photo');
  if (img) img.style.opacity = '1';
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = '';
  clearTimeout(photoPlaceholderTimer);
  photoPlaceholderTimer = setTimeout(function () {
    wrap.classList.remove('photo-loading', 'photo-placeholder-visible', 'photo-loaded');
  }, 260);
}

function showLightboxPhotoError(expectedToken) {
  if (expectedToken !== photoPlaceholderToken) return;
  let wrap = domRefs.lightboxImgWrap;
  let img = domRefs.lightboxImg;
  if (!wrap) return;
  wrap.classList.remove('photo-loaded');
  wrap.classList.add('photo-loading', 'photo-placeholder-visible', 'photo-error');
  if (img) img.removeAttribute('data-loading-photo');
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = 'image failed to load';
}

export function prepareLightboxPhoto(p) {
  let img = domRefs.lightboxImg;
  let wrap = domRefs.lightboxImgWrap;
  if (!img || !wrap || !p) return;

  let ratio = Number(p.aspectRatio) > 0 ? Number(p.aspectRatio) : 1;
  let token = ++photoPlaceholderToken;
  clearTimeout(photoPlaceholderTimer);
  wrap.style.setProperty('--lightbox-photo-ratio', ratio);
  img.alt = p.title || '';
  img.removeAttribute('title');
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = '';

  // ── Cache hit: image already decoded, swap instantly with no placeholder ──
  const cached = _imgCache.get(p.src);
  if (cached && cached.decoded) {
    wrap.classList.remove('photo-loading', 'photo-placeholder-visible', 'photo-loaded', 'photo-error');
    img.removeAttribute('data-loading-photo');
    img.src = p.src;
    img.style.opacity = '1';
    return;
  }

  // ── Cache miss: show placeholder while loading ──
  let previewSrc = p.thumb || (p.src ? p.src.replace('photos/', 'photos/thumbs/') : '');
  wrap.classList.remove('photo-placeholder-visible', 'photo-loaded', 'photo-error');
  wrap.classList.add('photo-loading');
  if (previewSrc) {
    img.removeAttribute('data-loading-photo');
    img.src = previewSrc;
    img.style.opacity = '1';
  } else {
    wrap.classList.add('photo-placeholder-visible');
    img.dataset.loadingPhoto = 'true';
  }

  // Load and decode the image entirely off-DOM in the background cache.
  // This prevents the DOM injection from stalling the CSS entrance animations.
  let cacheEntry = _cacheImage(p.src);

  if (cacheEntry && cacheEntry.decodePromise) {
    cacheEntry.decodePromise.then(() => {
      if (token !== photoPlaceholderToken) return;
      img.src = p.src;
      // Allow browser to register the instant src before clearing placeholder
      requestAnimationFrame(() => {
        if (token !== photoPlaceholderToken) return;
        clearLightboxPhotoPlaceholder(token);
      });
    });
  } else {
    // Fallback just in case
    img.src = p.src;
    img.onload = function () {
      if (token !== photoPlaceholderToken) return;
      clearLightboxPhotoPlaceholder(token);
    };
    img.onerror = function () {
      if (token !== photoPlaceholderToken) return;
      showLightboxPhotoError(token);
    };
  }
}

function runDescFlipTransition(options) {
  let imgWrap = domRefs.lightboxImgWrap;
  let infoWrap = domRefs.lightboxInfoWrap;
  let applyLayoutChange = options.applyLayoutChange;
  let cleanup = options.cleanup;

  if (!imgWrap || !infoWrap) {
    applyLayoutChange();
    if (cleanup) cleanup();
    return;
  }

  let startImg = options.startImgRect || imgWrap.getBoundingClientRect();
  let startInfo = options.startInfoRect || infoWrap.getBoundingClientRect();

  applyLayoutChange();

  let endImg = imgWrap.getBoundingClientRect();
  let endInfo = infoWrap.getBoundingClientRect();
  let dImg = startImg.top - endImg.top;
  let dInfo = startInfo.top - endInfo.top;

  imgWrap.style.transition = 'none';
  imgWrap.style.transform = 'translateY(' + dImg + 'px)';
  infoWrap.style.transition = 'none';
  infoWrap.style.transform = 'translateY(' + dInfo + 'px)';
  if (options.afterInvert) options.afterInvert();

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      imgWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      imgWrap.style.transform = '';
      infoWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      infoWrap.style.transform = '';
      setTimeout(function () {
        imgWrap.style.transition = '';
        infoWrap.style.transition = '';
        if (cleanup) cleanup();
      }, 450);
    });
  });
} function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function resetDynamicTextColor() {
  const lbEl = domRefs.lightbox;
  if (lbEl) {
    lbEl.style.removeProperty('--dynamic-text-color');
    lbEl.style.removeProperty('--dynamic-text-muted');
    lbEl.style.removeProperty('--dynamic-text-faint');
  }
}

function updateDynamicTextColor(p) {
  if (state.currentLightboxIsMotion) {
    resetDynamicTextColor();
    return;
  }

  const thumbSrc = p.thumb || p.src;
  if (!thumbSrc) {
    resetDynamicTextColor();
    return;
  }

  const cached = _cacheImage(thumbSrc);
  if (!cached) {
    resetDynamicTextColor();
    return;
  }

  function processColor() {
    // Verify that we are still displaying the same photo
    const currentSet = state.currentLightboxIsMotion ? motionProjects : state.activePhotos;
    if (!currentSet || currentSet[state.cur] !== p) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cached.img, 0, 0, 10, 10);
      const imgData = ctx.getImageData(0, 0, 10, 10).data;

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];
        if (a > 200) {
          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }
      }

      if (count > 0) {
        const r = Math.round(rSum / count);
        const g = Math.round(gSum / count);
        const b = Math.round(bSum / count);

        const hsl = rgbToHsl(r, g, b);

        // Mute saturation to a beautiful elegant range (18% - 35%)
        const s = Math.min(Math.max(hsl.s * 0.75, 18), 35);

        // Lightness kept high and highly readable (82% - 85%) to guarantee contrast
        const l = Math.min(Math.max(hsl.l, 82), 85);

        const lbEl = domRefs.lightbox;
        if (lbEl) {
          lbEl.style.setProperty('--dynamic-text-color', `hsl(${hsl.h}, ${s}%, ${l}%)`);
          lbEl.style.setProperty('--dynamic-text-muted', `hsla(${hsl.h}, ${s}%, ${l}%, 0.78)`);
          lbEl.style.setProperty('--dynamic-text-faint', `hsla(${hsl.h}, ${s}%, ${l}%, 0.40)`);
        }
      } else {
        resetDynamicTextColor();
      }
    } catch (e) {
      console.warn("Dynamic text color extraction failed (possibly CORS):", e);
      resetDynamicTextColor();
    }
  }

  if (cached.decoded) {
    processColor();
  } else if (cached.decodePromise) {
    cached.decodePromise.then(processColor);
  } else {
    cached.img.addEventListener('load', function onLoad() {
      cached.img.removeEventListener('load', onLoad);
      processColor();
    });
    cached.img.addEventListener('error', function onError() {
      cached.img.removeEventListener('error', onError);
      resetDynamicTextColor();
    });
  }
}

// updates text + blur bg only — image src is set separately to avoid double-load
export function setLightboxContent(p, options) {
  if (!p) return;
  options = options || {};
  refreshLightboxInfoRefs();
  if (options.deferDynamicTextColor) {
    resetDynamicTextColor();
    scheduleAfterMotionFrame(function () {
      updateDynamicTextColor(p);
    }, 180);
  } else {
    updateDynamicTextColor(p);
  }

  let safeTitle = p.title || '';
  let safeDesc = p.desc || '';
  let content = domRefs.lightboxContent;
  let btn = domRefs.lightboxDescToggle;
  let descEl = domRefs.lightboxDesc;
  let isCollapsingOpenDesc = content && content.classList.contains('desc-open');
  let preSwapImgRect = null;
  let preSwapInfoRect = null;

  if (isCollapsingOpenDesc && state.isMobile) {
    let preSwapImgWrap = domRefs.lightboxImgWrap;
    let preSwapInfoWrap = domRefs.lightboxInfoWrap;
    if (preSwapImgWrap && preSwapInfoWrap) {
      preSwapImgRect = preSwapImgWrap.getBoundingClientRect();
      preSwapInfoRect = preSwapInfoWrap.getBoundingClientRect();
    }
    if (descEl) descEl.style.transition = 'none';
  }

  if (domRefs.lightboxTitle) domRefs.lightboxTitle.textContent = safeTitle;
  if (descEl) descEl.innerHTML = safeDesc;
  let locItem = domRefs.metaLocation;
  if (p.location) {
    if (domRefs.metaLocationText) domRefs.metaLocationText.textContent = p.location;
    if (locItem) locItem.style.display = 'inline-flex';
  } else if (locItem) {
    locItem.style.display = 'none';
  }

  let dateItem = domRefs.metaDate;
  if (p.date) {
    if (domRefs.metaDateText) domRefs.metaDateText.textContent = p.date;
    if (dateItem) dateItem.style.display = 'inline-flex';
  } else if (dateItem) {
    dateItem.style.display = 'none';
  }

  let musicItem = domRefs.metaMusic;
  if (p.music) {
    if (domRefs.metaMusicText) domRefs.metaMusicText.textContent = p.music;
    if (musicItem) musicItem.style.display = 'inline-flex';
  } else if (musicItem) {
    musicItem.style.display = 'none';
  }

  // Deep Link: Automatically update the URL hash dynamically for routing tracking
  let catSlug = getCategorySlug(state.currentCategory);
  let slug = slugify(safeTitle);
  let newHash = '#' + catSlug + '/' + slug;
  if (slug && window.location.hash !== newHash) {
    if (state.isPopState) {
      history.replaceState(null, null, newHash);
    } else if (state.pushNextState) {
      history.pushState(null, null, newHash);
      state.pushNextState = false;
    } else {
      history.replaceState(null, null, newHash);
    }
  }

  // conditionally hide the "read" toggle when photo has no description
  if (btn) {
    let hasDesc = safeDesc.replace(/<[^>]*>/g, '').trim().length > 0;
    btn.classList.toggle('no-desc', !hasDesc);
  }

  updateLightboxDescPreview();

  if (content && content.classList.contains('desc-open')) {
    runDescFlipTransition({
      startImgRect: state.isMobile ? preSwapImgRect : null,
      startInfoRect: state.isMobile ? preSwapInfoRect : null,
      applyLayoutChange: function () {
        content.classList.remove('desc-open');
        if (btn) btn.textContent = 'read more';
        updateLightboxDescPreview();
      },
      cleanup: state.isMobile && descEl ? function () { descEl.style.transition = ''; } : null
    });
  } else if (btn) {
    btn.textContent = 'read more';
    updateLightboxDescPreview();
  }
}

function updateLightboxDescPreview() {
  let desc = domRefs.lightboxDesc;
  let btn = domRefs.lightboxDescToggle;
  let content = domRefs.lightboxContent;
  if (!desc || !btn || !content || !state.isMobile) return;

  let hasDesc = desc.textContent.trim().length > 0;
  desc.classList.toggle('desc-expanded', content.classList.contains('desc-open'));

  if (!hasDesc) {
    desc.classList.remove('desc-overflow');
    btn.classList.add('no-desc');
    return;
  }

  let styles = window.getComputedStyle(desc);
  let lineHeight = parseFloat(styles.lineHeight);
  if (!lineHeight) lineHeight = parseFloat(styles.fontSize) * 1.75;
  let previewHeight = lineHeight * 2;
  let hasOverflow = desc.scrollHeight > previewHeight + 1;

  desc.classList.toggle('desc-overflow', hasOverflow);
  btn.classList.toggle('no-desc', !hasOverflow);
}


export function animateInfo(dir) {
  let info = domRefs.lightboxInfo;
  if (!info || !info.parentNode) {
    domRefs.lightboxInfo = domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') : null;
    info = domRefs.lightboxInfo;
    if (!info || !info.parentNode) return;
  }

  // only animate exit if there's visible content (opacity > 0 means it's shown)
  let hasContent = info && parseFloat(window.getComputedStyle(info).opacity) > 0.05;
  if (hasContent) {
    // create exit ghost — absolutely positioned so it doesn't shift layout
    let ghost = info.cloneNode(true);
    ghost.style.position = 'absolute';
    ghost.style.top = info.offsetTop + 'px';
    ghost.style.left = info.offsetLeft + 'px';
    ghost.style.width = info.offsetWidth + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.removeAttribute('onclick'); // prevent stale tap capture on mobile
    ghost.style.animation = 'lbInfoOut 0.22s ease forwards';
    ghost.style.willChange = 'filter, opacity';
    ghost.style.zIndex = '1';
    info.parentNode.appendChild(ghost);
    setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 250);
  }

  // clone-replace for enter — clean slate, no animation-cancel issues
  let fromX = dir === 0 ? 0 : (dir > 0 ? 24 : -24);
  let fromY = dir === 0 ? 16 : 0;
  let clone = info.cloneNode(true);
  clone.style.setProperty('--lb-from-x', fromX + 'px');
  clone.style.setProperty('--lb-from-y', fromY + 'px');
  clone.style.animation = 'lbInfoIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards';
  clone.style.willChange = 'filter, opacity, transform';
  // clear any lingering inline transition/filter from swipe scroll handler
  clone.style.transition = '';
  clone.style.filter = '';
  info.parentNode.replaceChild(clone, info);
  domRefs.lightboxInfo = clone;
  refreshLightboxInfoRefs();
}

// increments each navigation so stale callbacks from aborted navigations are ignored
let navGen = 0;

function scheduleAfterMotionFrame(callback, delay) {
  requestAnimationFrame(function () {
    setTimeout(callback, delay || 0);
  });
}

function getCurrentLightboxItems() {
  return state.currentLightboxIsMotion ? motionProjects : state.activePhotos;
}

export function openLightbox(i, direction, isMotion) {
  let lb = domRefs.lightbox;
  if (lb && !lb.classList.contains('open') && !state.isPopState) {
    state.pushNextState = true;
  }

  state.cur = i;
  state.isManuallyNavigating = true;
  state.currentLightboxIsMotion = !!isMotion;
  let p = getCurrentLightboxItems()[i];

  if (!p) return;
  if (!isMotion) scheduleLightboxBlurNeighborPreload(i, lb && lb.classList.contains('open') ? 80 : 300);
  let img = domRefs.lightboxImg;
  let imgWrap = domRefs.lightboxImgWrap;
  let playerShell = domRefs.motionPlayerShell;

  if (isMotion) lb.classList.add('mode-motion');
  else lb.classList.remove('mode-motion');
  if (isMotion) clearLightboxPhotoPlaceholder();

  // Mobile: already open — natively smooth scroll
  if (lb.classList.contains('open') && state.isMobile && mobileScrollToSlideCallback && !isMotion) {
    // Fallback to 1 if direction evaluates to 0 or is mathematically missing
    let dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    mobileScrollToSlideCallback(i, true, dir);

    state.cur = i;
    updateFilmstrip();
    return;
  }

  if (lb.classList.contains('open')) {
    let dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    let exitX = dir > 0 ? '-6%' : '6%';
    let enterX = dir > 0 ? '6%' : '-6%';
    let gen = ++navGen;

    // exit current media immediately — snappy
    img.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    img.style.opacity = '0';
    img.style.transform = 'translateX(' + exitX + ') scale(0.98)';
    playerShell.style.opacity = '0';

    // hide info panel immediately so old text isn't visible
    let infoEl = domRefs.lightboxInfo;
    if (infoEl) {
      infoEl.style.animation = 'none';
      infoEl.style.opacity = '0';
    }

    // update blur bg immediately (visual polish)
    showFilmstripIfReady();

    let entered = false;

    function doEnter() {
      if (entered || gen !== navGen) return;
      entered = true;

      // blank src, position off-screen, fully invisible — nothing bleeds through
      img.onload = null; img.onerror = null;
      img.src = '';
      img.style.transition = 'none';
      img.style.transform = '';
      img.style.opacity = '0';
      imgWrap.style.transition = 'none';
      imgWrap.style.transform = 'translateX(' + enterX + ') scale(0.98)';
      imgWrap.style.opacity = '0';
      playerShell.innerHTML = '';
      playerShell.style.opacity = '0';

      let bSrc = isMotion ? p.thumb : (p.thumb || p.src);
      if (!isMotion) {
        prepareLightboxPhoto(p);
        void imgWrap.offsetWidth;
        imgWrap.style.transition = 'opacity 0.32s ease, transform 0.46s cubic-bezier(0.16,1,0.3,1)';
        imgWrap.style.opacity = '1';
        imgWrap.style.transform = 'translateX(0) scale(1)';
        img.style.transition = 'opacity 0.32s ease';
        img.style.opacity = '1';
        scheduleAfterMotionFrame(function () {
          if (gen !== navGen) return;
          setLightboxBlur(bSrc);
          setLightboxContent(p, { deferDynamicTextColor: true });
          animateInfo(dir);
        }, 140);
        scheduleAfterMotionFrame(function () {
          if (gen === navGen) loadSwipeNeighbors();
        }, 280);
        return;
      }

      requestAnimationFrame(function () {
        if (gen !== navGen) return;

        if (isMotion) {
          setLightboxBlur(bSrc);
          setLightboxContent(p, { deferDynamicTextColor: true });
          renderVideoInLightbox(p);
          playerShell.style.transition = 'opacity 0.35s ease';
          playerShell.style.opacity = '1';
          scheduleAfterMotionFrame(function () {
            if (gen === navGen) animateInfo(dir);
          }, 0);
        }
      });
    }

    if (isMotion) {
      doEnter();
    } else {
      doEnter();
    }

  } else {
    // INITIAL OPEN
    let openGen = ++navGen;
    previouslyFocusedElement = document.activeElement;

    // media starts invisible — no content yet
    img.onload = null; img.onerror = null;
    img.src = '';
    img.style.transition = 'none';
    img.style.opacity = '0';
    img.style.transform = '';
    imgWrap.style.transition = '';
    imgWrap.style.opacity = '';
    imgWrap.style.transform = '';
    playerShell.innerHTML = '';
    playerShell.style.opacity = '0';

    // info panel fully hidden — no stale text visible
    let infoEl2 = domRefs.lightboxInfo;
    if (infoEl2) {
      infoEl2.style.animation = 'none';
      infoEl2.style.opacity = '0';
    }

    let header = domRefs.galleryHeader;
    let masonry = domRefs.masonry;
    let headerRect = header ? header.getBoundingClientRect() : null;
    let masonryRect = masonry ? masonry.getBoundingClientRect() : null;

    lb.classList.add('open');
    let closeBtn = document.getElementById('lightbox-close');
    if (closeBtn) {
      if (state.lastInputType !== 'keyboard') {
        closeBtn.classList.add('prevent-focus-ring');
        closeBtn.addEventListener('blur', function removePFR() {
          closeBtn.classList.remove('prevent-focus-ring');
          closeBtn.removeEventListener('blur', removePFR);
        });
      }
      closeBtn.focus();
    }
    document.body.classList.add('lightbox-open');
    lb.scrollTop = 0;
    document.body.style.overflow = 'hidden';

    // ── FLIP: Invert ──
    if (header && headerRect) {
      let last = header.getBoundingClientRect();
      let dX = headerRect.left - last.left;
      let dY = headerRect.top - last.top;
      header.style.transition = 'none';
      header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
    }
    if (masonry && masonryRect) {
      let lastM = masonry.getBoundingClientRect();
      let dXm = masonryRect.left - lastM.left;
      let dYm = masonryRect.top - lastM.top;
      masonry.style.transition = 'none';
      masonry.style.transform = 'translate(' + dXm + 'px, ' + dYm + 'px)';
    }

    requestAnimationFrame(function () {
      let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
      if (header) {
        header.style.transition = ease;
        header.style.transform = '';
      }
      if (masonry) {
        masonry.style.transition = ease;
        masonry.style.transform = '';
      }
    });

    setFilmstripLiftZoneDisplay('block');
    window.dispatchEvent(new Event('lightbox-open'));
    setTimeout(showFilmstripIfReady, 300);

    let hint = document.getElementById('swipe-hint');
    if (hint) {
      hint.classList.add('visible');
      setTimeout(function () { hint.classList.remove('visible'); }, 2500);
    }

    let openLoadFired = false;
    function afterOpenLoad() {
      if (openLoadFired || openGen !== navGen) return;
      openLoadFired = true;
      if (isMotion) {
        img.onload = null;
        img.onerror = null;
      }

      let bSrc = isMotion ? p.thumb : (p.thumb || p.src);
      setLightboxBlur(bSrc);
      setLightboxContent(p);
      if (!isMotion) loadSwipeNeighbors();

      requestAnimationFrame(function () {
        if (openGen !== navGen) return;
        animateInfo(0);
        void img.offsetWidth; // force reflow — Firefox transition fix

        if (isMotion) {
          renderVideoInLightbox(p);
          playerShell.style.transition = 'opacity 0.45s ease';
          playerShell.style.opacity = '1';
        } else {
          img.style.transition = 'opacity 0.45s ease';
          img.style.opacity = '1';
        }
      });
    }

    // Start the image immediately; the browser paints it as soon as pixels arrive.
    requestAnimationFrame(function () {
      if (isMotion) {
        afterOpenLoad();
      } else {
        prepareLightboxPhoto(p);
        afterOpenLoad();
      }
    });
  }
}

export function renderVideoInLightbox(p) {
  let shell = domRefs.motionPlayerShell;
  if (!shell) return;
  let ratio = p.aspectRatio || (16 / 9);
  shell.style.aspectRatio = ratio;
  shell.style.width = 'min(100%, calc((100svh - 15rem) * ' + ratio + '))';
  shell.innerHTML = getVideoPlayerMarkup(p);
  shell.style.opacity = '1';
  shell.style.display = 'block'; // Ensure it's not hidden
}

export function startUnifiedMotionPlayer(id) {
  let prime = document.getElementById(id);
  if (!prime) return;
  let video = prime.querySelector('video');
  prime.classList.add('is-started');
  if (video) video.play().catch(function () { });
}

export function closeLightbox(eventOrIsKeyboard = false) {
  let isKeyboard = false;
  if (typeof eventOrIsKeyboard === 'boolean') {
    isKeyboard = eventOrIsKeyboard;
  } else if (eventOrIsKeyboard && eventOrIsKeyboard.type === 'click') {
    let e = eventOrIsKeyboard;
    isKeyboard = e.detail === 0 && (!e.pointerType || e.pointerType === '');
  }

  let lb = domRefs.lightbox;
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('window-blurred');

  let header = domRefs.galleryHeader;
  let masonry = domRefs.masonry;
  let headerRect = header ? header.getBoundingClientRect() : null;
  let masonryRect = masonry ? masonry.getBoundingClientRect() : null;

  let img = domRefs.lightboxImg;
  let activeGen = ++navGen; // invalidates all pending callbacks
  lb.classList.remove('open');
  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
    let el = previouslyFocusedElement;
    if (!(isKeyboard || state.lastInputType === 'keyboard')) {
      el.classList.add('prevent-focus-ring');
      el.addEventListener('blur', function removePFR() {
        el.classList.remove('prevent-focus-ring');
        el.removeEventListener('blur', removePFR);
      });
    }
    el.focus();
  }
  previouslyFocusedElement = null;
  document.body.classList.remove('lightbox-open');
  document.body.style.overflow = '';
  clearFilmstripHideTimerIfReady();
  hideFilmstripIfReady();
  setFilmstripLiftZoneDisplay('none');

  // ── FLIP: Invert ──
  if (header && headerRect) {
    let last = header.getBoundingClientRect();
    let dX = headerRect.left - last.left;
    let dY = headerRect.top - last.top;
    header.style.transition = 'none';
    header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
  }
  if (masonry && masonryRect) {
    let lastM = masonry.getBoundingClientRect();
    let dXm = masonryRect.left - lastM.left;
    let dYm = masonryRect.top - lastM.top;
    masonry.style.transition = 'none';
    masonry.style.transform = 'translate(' + dXm + 'px, ' + dYm + 'px)';
  }

  requestAnimationFrame(function () {
    let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    if (header) {
      header.style.transition = ease;
      header.style.transform = '';
    }
    if (masonry) {
      masonry.style.transition = ease;
      masonry.style.transform = '';
    }

    // Restart Lenis and sync state once transition has a head start
    setTimeout(function () {
      if (window.lenis) {
        window.lenis.start();
        window.lenis.animatedScroll = window.lenis.targetScroll = window.scrollY;
        window.lenis.emit(); // Force sync of all UI driven by scroll hub
      }
    }, 400);
  });

  let playerShell = domRefs.motionPlayerShell;
  if (playerShell) playerShell.innerHTML = '';

  if (domRefs.blurCanvas) {
    domRefs.blurCanvas.classList.remove('active');
  }
  if (blurRenderer) {
    blurRenderer.stopAnimation();
  }
  if (blurPreloadTimer) {
    clearTimeout(blurPreloadTimer);
    blurPreloadTimer = null;
  }
  // Reset hash to category on close
  if (window.location.hash && !state.isPopState) {
    let catSlug = getCategorySlug(state.currentCategory);
    history.pushState(null, null, '#' + catSlug);
  }

  // Delay DOM teardown until the opacity fade finishes
  setTimeout(function () {
    if (activeGen !== navGen) return; // Abort if user reopened lightbox quickly
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img.removeAttribute('data-loading-photo');
      clearLightboxPhotoPlaceholder();
      img.classList.remove('zoomed');
      img.style.transition = '';
      img.style.transform = '';
      img.style.transformOrigin = '';
      img.style.opacity = '';
    }
    if (domRefs.lightboxImgWrap) {
      domRefs.lightboxImgWrap.style.transition = '';
      domRefs.lightboxImgWrap.style.transform = '';
      domRefs.lightboxImgWrap.style.opacity = '';
    }

    let info = domRefs.lightboxInfo;
    if (info) {
      info.style.animation = 'none';
      info.style.opacity = '0';
      info.style.transition = '';
      info.style.filter = '';
      info.style.transform = '';
    }

    let content = domRefs.lightboxContent;
    if (content) {
      content.classList.remove('desc-open');
      content.style.transition = '';
      content.style.transform = '';
      content.style.transformOrigin = '';
      content.style.opacity = '';
    }
    let lb = domRefs.lightbox;
    if (lb) lb.classList.remove('zoom-active');

    if (state.isMobile) {
      let mWrap = domRefs.lightboxImgWrap;
      if (mWrap) {
        mWrap.style.transform = '';
        mWrap.style.overflowX = '';
        mWrap.style.overflowY = '';
      }
      state.lbZoomLevel = 1;
      state.lbZoomPanX = 0;
      state.lbZoomPanY = 0;
      let slides = mWrap ? mWrap.querySelectorAll('.snap-slide') : [];
      for (let si = 0; si < slides.length; si++) {
        slides[si].style.opacity = '';
        slides[si].style.transition = '';
        let slideImg = slides[si].querySelector('img');
        if (slideImg) {
          slideImg.classList.remove('zoomed');
          slideImg.style.transform = '';
          slideImg.style.position = '';
          slideImg.style.zIndex = '';
          slideImg.style.cursor = '';
          delete slideImg.dataset.zoomAnimated;
        }
      }
    }

    let dark = domRefs.lightboxZoomDarken;
    if (dark) dark.style.opacity = '0';
  }, 400);
}

export function toggleLightboxDesc() {
  let content = domRefs.lightboxContent;
  let btn = domRefs.lightboxDescToggle;
  if (!content || !btn || btn.classList.contains('no-desc')) return;

  let desc = domRefs.lightboxDesc;
  let opening = !content.classList.contains('desc-open');

  runDescFlipTransition({
    applyLayoutChange: function () {
      content.classList.toggle('desc-open', opening);
      btn.textContent = opening ? 'read less' : 'read more';
      updateLightboxDescPreview();
      if (opening) hideFilmstripIfReady();
      else showFilmstripIfReady();
    },
    afterInvert: function () {
      if (desc) void desc.offsetHeight;
    }
  });
}

// reset desc expansion on new photo
export function resetDescToggle() {
  let info = domRefs.lightboxInfo;
  let btn = domRefs.lightboxDescToggle;
  if (info) info.classList.remove('desc-open');
  if (btn) btn.textContent = 'read more';
}

export function loadSwipeNeighbors() {
  if (state.currentLightboxIsMotion) return;
  let currentSet = getCurrentLightboxItems();
  let len = currentSet.length;

  // Preload & cache ±2 high-res neighbors (to save bandwidth)
  [-2, -1, 1, 2].forEach(function (offset) {
    let p = currentSet[(state.cur + offset + len) % len];
    if (p && p.src) _cacheImage(p.src);
  });

  // Preload & cache ±6 blurred backgrounds (super light, 3.7KB each)
  [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].forEach(function (offset) {
    let p = currentSet[(state.cur + offset + len) % len];
    if (p) {
      let bSrc = p.thumb || p.src;
      if (bSrc) {
        _cacheImage(getLightboxBlurPath(bSrc));
      }
    }
  });

  if (typeof swipeNeighborsCallback === 'function') {
    swipeNeighborsCallback();
  }
}

export function setLoadSwipeNeighbors(fn) {
  swipeNeighborsCallback = fn;
}

export function navigateLightbox(d) {
  if (typeof state.lbZoomLevel !== 'undefined' && state.lbZoomLevel > 1) resetZoom();
  let currentSet = getCurrentLightboxItems();
  state.cur = (state.cur + d + currentSet.length) % currentSet.length;
  openLightbox(state.cur, d, state.currentLightboxIsMotion);
}

document.addEventListener('keydown', function (e) {
  let target = e.target;
  let isTyping = target && (
    target.matches && target.matches('input, textarea, select, [contenteditable="true"]')
  );
  if (isTyping || !domRefs.lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') {
    closeLightbox(true);
  }
  let key = e.key.toLowerCase();
  if (e.key === 'ArrowRight' || key === 'd' || key === 's') navigateLightbox(1);
  if (e.key === 'ArrowLeft' || key === 'a' || key === 'w') navigateLightbox(-1);
});

// desktop: click bg to close
if (!state.isMobile) domRefs.lightboxBg.addEventListener('click', closeLightbox);

function handleLightboxBlur() {
  if (domRefs.lightbox && domRefs.lightbox.classList.contains('open')) {
    domRefs.lightbox.classList.add('window-blurred');
    
    if (blurRenderer) {
      blurRenderer.stopAnimation();
    }
    
    let video = domRefs.motionPlayerShell ? domRefs.motionPlayerShell.querySelector('video') : null;
    if (video && !video.paused) {
      video.pause();
      video.dataset.wasPlaying = 'true';
    }
  }
}

function handleLightboxFocus() {
  if (domRefs.lightbox) {
    domRefs.lightbox.classList.remove('window-blurred');
    
    if (blurRenderer && domRefs.lightbox.classList.contains('open')) {
      blurRenderer.startAnimation();
    }
    
    let video = domRefs.motionPlayerShell ? domRefs.motionPlayerShell.querySelector('video') : null;
    if (video && video.dataset.wasPlaying === 'true') {
      video.play().catch(function () {});
      delete video.dataset.wasPlaying;
    }
  }
}

window.addEventListener('blur', handleLightboxBlur);
window.addEventListener('focus', handleLightboxFocus);

document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    handleLightboxBlur();
  } else {
    handleLightboxFocus();
  }
});
