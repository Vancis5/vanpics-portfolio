function solveCubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return function(x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      let currentX = 3.0 * (1.0 - t) * (1.0 - t) * t * x1 + 3.0 * (1.0 - t) * t * t * x2 + t * t * t;
      let derivative = 3.0 * (1.0 - t) * (1.0 - t) * x1 + 6.0 * (1.0 - t) * t * (x2 - x1) + 3.0 * t * t * (1.0 - x2);
      if (Math.abs(derivative) < 1e-5) break;
      t -= (currentX - x) / derivative;
    }
    return 3.0 * (1.0 - t) * (1.0 - t) * t * y1 + 3.0 * (1.0 - t) * t * t * y2 + t * t * t;
  };
}

const easeOutExpoLike = solveCubicBezier(0.15, 1.0, 0.4, 1.0);

export class WebGLBlurRenderer {
  canvas: any;
  gl: any;
  width: number;
  height: number;
  startTime: number;
  animating: boolean;
  mixFactor: number;
  transitionSpeed: number;
  animationId: any;
  dirPrev: number;
  dirCurr: number;
  textures: { prev: any; current: any; };
  progLiquid: any;
  progDown: any;
  progUp: any;
  fbos: any;
  dummyTexture: any;
  quadBuffer: any;

  constructor(canvas: any) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false
    });
    if (!this.gl) {
      console.warn('WebGL context creation failed');
      return;
    }
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.width = 256;
    this.height = 256;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.startTime = performance.now();
    this.animating = false;
    this.mixFactor = 1.0;
    this.transitionSpeed = 0.012;
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

    this.textures.prev = this.dummyTexture;
    this.textures.current = this.dummyTexture;
    this.mixFactor = 1.0;
    this.render();
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

      vec2 twist(vec2 coord, vec2 offset, float radius, float angle) {
        coord -= offset;
        float dist = length(coord);
        if (dist < radius) {
          float ratioDist = (radius - dist) / radius;
          float angleMod = ratioDist * ratioDist * angle;
          float s = sin(angleMod);
          float c = cos(angleMod);
          coord = vec2(coord.x * c - coord.y * s, coord.x * s + coord.y * c);
        }
        coord += offset;
        return coord;
      }

      vec2 applyTwists(vec2 uv, float dir) {
        vec2 offset1 = vec2(0.35 + 0.15 * cos(u_time * 0.4), 0.45 + 0.15 * sin(u_time * 0.5));
        float radius1 = 0.5;
        float angle1 = dir * 2.5 * sin(u_time * 0.3);
        uv = twist(uv, offset1, radius1, angle1);

        vec2 offset2 = vec2(0.65 + 0.15 * sin(u_time * 0.45), 0.55 + 0.15 * cos(u_time * 0.35));
        float radius2 = 0.45;
        float angle2 = -dir * 2.0 * cos(u_time * 0.4);
        uv = twist(uv, offset2, radius2, angle2);

        return uv;
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
        uv = applyTwists(uv, dir);

        float k0 = fract(u_time / 45.0);
        float angle0 = dir * k0 * 2.0 * 3.14159265;
        float scale0 = mix(1.2, 1.35, 0.5 - 0.5 * cos(k0 * 2.0 * 3.14159265));
        vec2 trans0 = mix(vec2(0.0, 0.0), vec2(-0.03, 0.02), 0.5 - 0.5 * cos(k0 * 2.0 * 3.14159265));
        vec2 uv0 = transformUV(uv, angle0, scale0, trans0);
        vec4 baseColor = texture2D(tex, clamp(uv0, 0.0, 1.0));

        float k1 = 0.5 - 0.5 * cos(u_time * 2.0 * 3.14159265 / 64.0);
        float angle1 = dir * (2.0 * 3.14159265) * (1.0 - k1);
        float scale1 = mix(1.4, 1.15, 0.5 - 0.5 * cos(k1 * 2.0 * 3.14159265));
        vec2 trans1 = mix(vec2(0.02, -0.03), vec2(-0.04, 0.04), 0.5 - 0.5 * cos(k1 * 2.0 * 3.14159265));
        vec2 uv1 = transformUV(uv, angle1, scale1, trans1);
        vec4 twist1Color = texture2D(tex, clamp(uv1, 0.0, 1.0));
        vec3 col = mix(baseColor.rgb, blendScreen(baseColor.rgb, twist1Color.rgb), 0.45);

        float k2 = 0.5 + 0.5 * cos(u_time * 2.0 * 3.14159265 / 48.0);
        float angle2 = dir * (3.14159265 / 4.0 + (0.5 - 0.5 * cos(k2 * 2.0 * 3.14159265)) * (3.14159265 * 0.5));
        float scale2 = mix(1.1, 1.5, 0.5 - 0.5 * cos(k2 * 2.0 * 3.14159265));
        vec2 trans2 = mix(vec2(-0.05, -0.05), vec2(0.04, 0.04), 0.5 - 0.5 * cos(k2 * 2.0 * 3.14159265));
        vec2 uv2 = transformUV(uv, angle2, scale2, trans2);
        vec4 twist2Color = texture2D(tex, clamp(uv2, 0.0, 1.0));
        col = mix(col, blendOverlay(col, twist2Color.rgb), 0.35);

        return vec4(col, 1.0);
      }

      vec3 adjustSaturation(vec3 color, float saturation) {
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        return mix(vec3(luma), color, saturation);
      }

      void main() {
        vec4 col_prev = sampleLiquid(u_texture_prev, v_texCoord, u_dir_prev);
        vec4 col_curr = sampleLiquid(u_texture, v_texCoord, u_dir_curr);
        vec3 blended = mix(col_prev.rgb, col_curr.rgb, u_mix);
        
        vec3 saturated = adjustSaturation(blended, 1.5);
        vec3 finalColor = saturated * 0.2;
        
        gl_FragColor = vec4(finalColor, 1.0);
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

  compileShader(source: string, type: number) {
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

  createProgram(vsSource: string, fsSource: string) {
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

  createFramebuffer(w: number, h: number) {
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
      this.createFramebuffer(256, 256),
      this.createFramebuffer(128, 128),
      this.createFramebuffer(64, 64),
      this.createFramebuffer(32, 32),
      this.createFramebuffer(64, 64),
      this.createFramebuffer(128, 128)
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

  createWebGLTexture(img: any) {
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

  setImage(img: any) {
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

    let easedMix = easeOutExpoLike(this.mixFactor);

    let positionLocation = gl.getAttribLocation(this.progLiquid, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[0].fbo);
    gl.viewport(0, 0, this.fbos[0].w, this.fbos[0].h);
    gl.useProgram(this.progLiquid);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.prev || this.dummyTexture);
    gl.uniform1i(gl.getUniformLocation(this.progLiquid, 'u_texture_prev'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.current || this.dummyTexture);
    gl.uniform1i(gl.getUniformLocation(this.progLiquid, 'u_texture'), 1);

    gl.uniform1f(gl.getUniformLocation(this.progLiquid, 'u_mix'), easedMix);
    gl.uniform1f(gl.getUniformLocation(this.progLiquid, 'u_time'), elapsedSeconds);
    gl.uniform1f(gl.getUniformLocation(this.progLiquid, 'u_dir_prev'), this.dirPrev);
    gl.uniform1f(gl.getUniformLocation(this.progLiquid, 'u_dir_curr'), this.dirCurr);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if ((window as any).__killBlur) {
      this.runBlurPass(this.progDown, this.fbos[0].texture, 256, 256, null, 0.0);
    } else {
      this.runBlurPass(this.progDown, this.fbos[0].texture, 256, 256, this.fbos[1], 1.0);
      this.runBlurPass(this.progDown, this.fbos[1].texture, 128, 128, this.fbos[2], 1.0);
      this.runBlurPass(this.progDown, this.fbos[2].texture, 64, 64, this.fbos[3], 1.0);

      this.runBlurPass(this.progUp, this.fbos[3].texture, 32, 32, this.fbos[4], 1.2);
      this.runBlurPass(this.progUp, this.fbos[4].texture, 64, 64, this.fbos[5], 1.0);
      this.runBlurPass(this.progUp, this.fbos[5].texture, 128, 128, null, 1.0);
    }

    if (this.animating) {
      this.animationId = requestAnimationFrame(() => this.render());
    }
  }

  runBlurPass(program: any, inputTexture: any, sourceWidth: number, sourceHeight: number, outputFbo: any, offset: number) {
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

    gl.uniform2f(gl.getUniformLocation(program, 'u_halfPixel'), 1.0 / (2.0 * sourceWidth), 1.0 / (2.0 * sourceHeight));
    gl.uniform1f(gl.getUniformLocation(program, 'u_offset'), offset);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
