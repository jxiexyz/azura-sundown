import THREE from 'three';

const QUAD_VS = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

const BRIGHT_FS = `
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = max(max(c.r, c.g), c.b);
    float knee = uThreshold * uKnee + 1e-4;
    float soft = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee);
    float contrib = max(soft, l - uThreshold) / max(l, 1e-4);
    gl_FragColor = vec4(c * contrib, 1.0);
  }`;

const BLUR_FS = `
  uniform sampler2D tDiffuse;
  uniform vec2 uDir;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec2 o = uDir * uTexel;
    vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
    c += (texture2D(tDiffuse, vUv + o * 1.3846154).rgb + texture2D(tDiffuse, vUv - o * 1.3846154).rgb) * 0.3162162;
    c += (texture2D(tDiffuse, vUv + o * 3.2307692).rgb + texture2D(tDiffuse, vUv - o * 3.2307692).rgb) * 0.0702703;
    gl_FragColor = vec4(c, 1.0);
  }`;

const COMPOSITE_FS = `
  uniform sampler2D tBase;
  uniform sampler2D tBloom;
  uniform float uStrength;
  uniform float uExposure;
  uniform float uVignette;
  uniform vec2 uTexel;
  varying vec2 vUv;

  vec3 fxaa(vec2 uv) {
    vec3 rgbNW = texture2D(tBase, uv + vec2(-1.0, -1.0) * uTexel).rgb;
    vec3 rgbNE = texture2D(tBase, uv + vec2(1.0, -1.0) * uTexel).rgb;
    vec3 rgbSW = texture2D(tBase, uv + vec2(-1.0, 1.0) * uTexel).rgb;
    vec3 rgbSE = texture2D(tBase, uv + vec2(1.0, 1.0) * uTexel).rgb;
    vec3 rgbM = texture2D(tBase, uv).rgb;
    vec3 luma = vec3(0.299, 0.587, 0.114);
    float lNW = dot(rgbNW, luma);
    float lNE = dot(rgbNE, luma);
    float lSW = dot(rgbSW, luma);
    float lSE = dot(rgbSE, luma);
    float lM = dot(rgbM, luma);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
    float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
    float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = clamp(dir * rcpMin, vec2(-8.0), vec2(8.0)) * uTexel;
    vec3 rgbA = 0.5 * (texture2D(tBase, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tBase, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
    vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tBase, uv + dir * -0.5).rgb + texture2D(tBase, uv + dir * 0.5).rgb);
    float lB = dot(rgbB, luma);
    return (lB < lMin || lB > lMax) ? rgbA : rgbB;
  }

  vec3 rrtFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }

  void main() {
    vec3 base = fxaa(vUv);
    vec3 bloom = texture2D(tBloom, vUv).rgb;
    vec3 c = base + bloom * uStrength;
    c *= uExposure / 0.6;
    const mat3 inMat = mat3(
      vec3(0.59719, 0.07600, 0.02840),
      vec3(0.35458, 0.90834, 0.13383),
      vec3(0.04823, 0.01566, 0.83777));
    const mat3 outMat = mat3(
      vec3(1.60475, -0.10208, -0.00327),
      vec3(-0.53108, 1.10813, -0.07276),
      vec3(-0.07367, -0.00605, 1.07602));
    c = inMat * c;
    c = rrtFit(c);
    c = outMat * c;
    c = clamp(c, 0.0, 1.0);
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(lum), c, 1.1);
    c *= vec3(1.035, 1.0, 0.955);
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.1);
    vec2 q = vUv - 0.5;
    c *= 1.0 - uVignette * dot(q, q) * 1.7;
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
    c = mix(lo, hi, step(vec3(0.0031308), c));
    gl_FragColor = vec4(c, 1.0);
  }`;

export function createPostFX(renderer, scene, camera) {
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quadMesh.frustumCulled = false;
  quadScene.add(quadMesh);

  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uThreshold: { value: 1.18 }, uKnee: { value: 0.4 } },
    vertexShader: QUAD_VS,
    fragmentShader: BRIGHT_FS,
    depthTest: false,
    depthWrite: false,
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VS,
    fragmentShader: BLUR_FS,
    depthTest: false,
    depthWrite: false,
  });
  const compositeMat = new THREE.ShaderMaterial({
    uniforms: {
      tBase: { value: null },
      tBloom: { value: null },
      uStrength: { value: 0.32 },
      uExposure: { value: 1.0 },
      uVignette: { value: 0.16 },
      uTexel: { value: new THREE.Vector2() },
    },
    vertexShader: QUAD_VS,
    fragmentShader: COMPOSITE_FS,
    depthTest: false,
    depthWrite: false,
  });

  let rtScene = null;
  let rtA = null;
  let rtB = null;

  function setSize(width, height) {
    const pr = renderer.getPixelRatio();
    const w = Math.max(4, Math.floor(width * pr));
    const h = Math.max(4, Math.floor(height * pr));
    const hw = Math.max(2, w >> 1);
    const hh = Math.max(2, h >> 1);
    if (rtScene) rtScene.dispose();
    if (rtA) rtA.dispose();
    if (rtB) rtB.dispose();
    rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
    rtA = new THREE.WebGLRenderTarget(hw, hh, { type: THREE.HalfFloatType, depthBuffer: false });
    rtB = new THREE.WebGLRenderTarget(hw, hh, { type: THREE.HalfFloatType, depthBuffer: false });
    blurMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    compositeMat.uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  function pass(mat, target) {
    quadMesh.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  }

  function render() {
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
    brightMat.uniforms.tDiffuse.value = rtScene.texture;
    pass(brightMat, rtA);
    blurMat.uniforms.tDiffuse.value = rtA.texture;
    blurMat.uniforms.uDir.value.set(1, 0);
    pass(blurMat, rtB);
    blurMat.uniforms.tDiffuse.value = rtB.texture;
    blurMat.uniforms.uDir.value.set(0, 1);
    pass(blurMat, rtA);
    blurMat.uniforms.tDiffuse.value = rtA.texture;
    blurMat.uniforms.uDir.value.set(2.3, 0);
    pass(blurMat, rtB);
    blurMat.uniforms.tDiffuse.value = rtB.texture;
    blurMat.uniforms.uDir.value.set(0, 2.3);
    pass(blurMat, rtA);
    compositeMat.uniforms.tBase.value = rtScene.texture;
    compositeMat.uniforms.tBloom.value = rtA.texture;
    pass(compositeMat, null);
    renderer.setRenderTarget(null);
  }

  function present() {
    pass(compositeMat, null);
    renderer.setRenderTarget(null);
  }

  return { render, setSize, present };
}
