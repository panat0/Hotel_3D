// Sky dome with procedural drifting clouds + day / night lighting (sun, hemisphere, fog, exposure, bloom, environment).
import * as THREE from 'three';

const VS = `varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const FS = `uniform float uNight, uTime; uniform vec3 uSunDir; varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
void main(){
  vec3 d = normalize(vDir); float h = d.y, t = pow(clamp(h, 0., 1.), .45);
  vec3 dayC = mix(vec3(.70, .82, .94), vec3(.16, .40, .80), t), nightC = mix(vec3(.05, .07, .14), vec3(.004, .01, .035), t);
  vec3 sky = mix(dayC, nightC, uNight);
  if (h < 0.) sky = mix(vec3(.62, .70, .78), vec3(.03, .04, .07), uNight);
  float sd = max(dot(d, normalize(uSunDir)), 0.);
  sky += (1. - uNight) * vec3(1., .92, .75) * (pow(sd, 900.) * 6. + pow(sd, 10.) * .22);
  sky += uNight * vec3(.85, .9, 1.) * (smoothstep(.9994, .9997, sd) * 2.2 + pow(sd, 60.) * .08);
  if (uNight > .01 && h > 0.) { vec2 g = d.xz / (h + .25) * 260.; float s = step(.9965, hash(floor(g))) * smoothstep(.02, .3, h); sky += vec3(s) * uNight * (.6 + .4 * sin(uTime * 2. + hash(floor(g)) * 30.)); }
  if (h > .005) {
    vec2 uv = d.xz / (h + .1) * 1.4 + vec2(uTime * .006, uTime * .002);
    float c = smoothstep(.47, .78, fbm(uv)) * smoothstep(.005, .18, h), sh = fbm(uv * 1.8 + 3.1);
    vec3 cDay = mix(vec3(.74, .78, .86), vec3(1.0, .99, .97), sh), cNight = mix(vec3(.04, .05, .08), vec3(.14, .16, .22), sh);
    sky = mix(sky, mix(cDay, cNight, uNight), c * .92);
  }
  gl_FragColor = vec4(sky, 1.);
}`;

const DAY = {envK: 1, sun: 1.6, sunC: 0xfff0d8, hemi: .9, hemiSky: 0xbfd6ff, hemiGround: 0x4a3a2a, env: .6, fog: 0xbcd2e8, fogD: .00065, exp: 1.0, bloom: .25};
const NIGHT = {envK: .1, sun: .1, sunC: 0x9fb4e8, hemi: .1, hemiSky: 0x24335e, hemiGround: 0x0c0c10, env: .06, fog: 0x0b1424, fogD: .0009, exp: .95, bloom: .6};

export function createSky(scene, {sun, hemi, renderer, bloom}){
  const mat = new THREE.ShaderMaterial({vertexShader: VS, fragmentShader: FS, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {uNight: {value: 0}, uTime: {value: 0}, uSunDir: {value: sun.position.clone().normalize()}}});
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), mat); dome.frustumCulled = false; dome.renderOrder = -10; dome.name = 'SkyDome'; scene.add(dome);
  scene.background = null;
  let target = 0, k = 0, lastEnv = -1;
  // three r160 has no scene.environmentIntensity: scale every material's envMapIntensity instead (base value kept in userData)
  const envScale = (f, force) => { if (!force && Math.abs(f - lastEnv) < .002) return; lastEnv = f;
    scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m && 'envMapIntensity' in m) { if (m.userData.envBase === undefined) m.userData.envBase = m.envMapIntensity; m.envMapIntensity = m.userData.envBase * f; } }); };
  const cA = new THREE.Color(), cB = new THREE.Color(), lerpC = (a, b, t, out) => out.copy(cA.set(a)).lerp(cB.set(b), t);
  const apply = lights => {
    const t = k; mat.uniforms.uNight.value = t;
    scene.fog.density = THREE.MathUtils.lerp(DAY.fogD, NIGHT.fogD, t); lerpC(DAY.fog, NIGHT.fog, t, scene.fog.color);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exp, NIGHT.exp, t);
    envScale(THREE.MathUtils.lerp(DAY.envK, NIGHT.envK, t));
    if (!lights) return;
    sun.intensity = THREE.MathUtils.lerp(DAY.sun, NIGHT.sun, t); lerpC(DAY.sunC, NIGHT.sunC, t, sun.color);
    hemi.intensity = THREE.MathUtils.lerp(DAY.hemi, NIGHT.hemi, t); lerpC(DAY.hemiSky, NIGHT.hemiSky, t, hemi.color); lerpC(DAY.hemiGround, NIGHT.hemiGround, t, hemi.groundColor);
    bloom.strength = THREE.MathUtils.lerp(DAY.bloom, NIGHT.bloom, t);
  };
  apply(true);
  return {
    get night(){ return target > .5; },
    get k(){ return k; },
    setNight(n){ target = n ? 1 : 0; },
    refresh(){ envScale(lastEnv < 0 ? 1 : lastEnv, true); },
    // lights = false while a floor / room view owns the lighting
    update(time, dt, camera, lights){ mat.uniforms.uTime.value = time; dome.position.copy(camera.position); if (Math.abs(k - target) > 1e-3) k += Math.sign(target - k) * Math.min(Math.abs(target - k), dt / 1.6); apply(lights); }
  };
}
