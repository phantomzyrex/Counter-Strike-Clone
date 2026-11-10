import * as THREE from 'three';
import type {
  AABB2D,
  CoverIntactState,
  DestructibleCoverState,
  EnemyArchetype,
  WeaponId,
} from './rules';

const SANDSTONE_IMAGE_URL = '/src/assets/images/tex_sandstone_masonry_1794298808101.jpg';
const COBBLE_IMAGE_URL = '/src/assets/images/tex_courtyard_cobble_1794298809001.jpg';
const WOOD_IMAGE_URL = '/src/assets/images/tex_military_wood_1794298811148.jpg';
const CAMO_IMAGE_URL = '/src/assets/images/tex_tactical_camo_1794308998160.jpg';

export interface TacticalMaterialLibrary {
  sandstoneWall: THREE.MeshStandardMaterial;
  sandstoneTrim: THREE.MeshStandardMaterial;
  courtyardFloor: THREE.MeshStandardMaterial;
  desertTerrain: THREE.MeshStandardMaterial;
  woodCrate: THREE.MeshStandardMaterial;
  woodFrame: THREE.MeshStandardMaterial;
  concreteBarrier: THREE.MeshStandardMaterial;
  rebarSteel: THREE.MeshStandardMaterial;
  explosiveBarrelRed: THREE.MeshStandardMaterial;
  hazardTrim: THREE.MeshStandardMaterial;
  ballisticGlass: THREE.MeshPhysicalMaterial;
  gunmetalDark: THREE.MeshStandardMaterial;
  gunmetalBrushed: THREE.MeshStandardMaterial;
  walnutStock: THREE.MeshStandardMaterial;
  olivePolymer: THREE.MeshStandardMaterial;
  brassCasing: THREE.MeshStandardMaterial;
  copperDomeMat: THREE.MeshStandardMaterial;
  terracottaAwningMat: THREE.MeshStandardMaterial;
  sandbagMat: THREE.MeshStandardMaterial;
  palmFoliageMat: THREE.MeshStandardMaterial;
  camoMap: THREE.Texture;
  camoBumpMap: THREE.Texture;
  kevlarPlateMat: THREE.MeshStandardMaterial;
  tacticalLeatherBootMat: THREE.MeshStandardMaterial;
  balaclavaFabricMat: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

/**
 * Normalizes BoxGeometry / ExtrudeGeometry UVs to world-space meters so brick and stone textures
 * never stretch disproportionately across long vs short architectural surfaces.
 */
export function applyWorldSpaceUVs(geometry: THREE.BufferGeometry, tileMeters = 2.8): void {
  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  if (!pos || !norm || !uv) return;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));

    if (ny >= nx && ny >= nz) {
      uv.setXY(i, vx / tileMeters, vz / tileMeters);
    } else if (nx >= nz) {
      uv.setXY(i, vz / tileMeters, vy / tileMeters);
    } else {
      uv.setXY(i, vx / tileMeters, vy / tileMeters);
    }
  }
  uv.needsUpdate = true;
}

function createProceduralTexturePair(
  maxAnisotropy: number,
  drawAlbedo: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  drawBump: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;
  drawAlbedo(actx, size, size);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;
  drawBump(bctx, size, size);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatX, repeatY);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

export function createTacticalMaterials(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): TacticalMaterialLibrary {
  const maxAniso = renderer.capabilities.getMaxAnisotropy() || 1;
  const texturesToDispose: THREE.Texture[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const loader = new THREE.TextureLoader();

  // 1. High-Detail Sandstone Masonry Bump + Procedural Fallback Albedo
  const sandstoneTex = createProceduralTexturePair(
    maxAniso,
    (ctx, w, h) => {
      ctx.fillStyle = '#cbb086';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rowH;
        const cols = 4;
        const colW = w / cols;
        const offset = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * colW + offset;
          const shade = 192 + ((r * 17 + c * 31) % 32) - 16;
          ctx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.86)}, ${Math.floor(shade * 0.67)})`;
          ctx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);
        }
      }
      for (let i = 0; i < 1600; i++) {
        const sx = (i * 73) % w;
        const sy = (i * 139) % h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(70,52,32,0.16)' : 'rgba(255,245,225,0.12)';
        ctx.fillRect(sx, sy, 2, 2);
      }
    },
    (ctx, w, h) => {
      ctx.fillStyle = '#262626';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rowH;
        const cols = 4;
        const colW = w / cols;
        const offset = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * colW + offset;
          const bevelTone = 195 + ((r * 13 + c * 29) % 40) - 20;
          ctx.fillStyle = `rgb(${bevelTone},${bevelTone},${bevelTone})`;
          ctx.fillRect(x + 4, y + 4, colW - 8, rowH - 8);
        }
      }
      for (let i = 0; i < 2200; i++) {
        const sx = (i * 97) % w;
        const sy = (i * 61) % h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.2)';
        ctx.fillRect(sx, sy, 3, 3);
      }
    },
    1,
    1
  );
  texturesToDispose.push(sandstoneTex.map, sandstoneTex.bumpMap);

  // 2. Courtyard Cobblestone / Flagstone Bump + Fallback
  const floorTex = createProceduralTexturePair(
    maxAniso,
    (ctx, w, h) => {
      ctx.fillStyle = '#9c8b72';
      ctx.fillRect(0, 0, w, h);
      const grid = 8;
      const cell = w / grid;
      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          const v = 140 + ((gx * 23 + gy * 41) % 28) - 14;
          ctx.fillStyle = `rgb(${v + 14}, ${v + 4}, ${v - 12})`;
          ctx.fillRect(gx * cell + 2, gy * cell + 2, cell - 4, cell - 4);
        }
      }
    },
    (ctx, w, h) => {
      ctx.fillStyle = '#303030';
      ctx.fillRect(0, 0, w, h);
      const grid = 8;
      const cell = w / grid;
      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          const b = 185 + ((gx * 19 + gy * 37) % 50) - 25;
          ctx.fillStyle = `rgb(${b},${b},${b})`;
          ctx.fillRect(gx * cell + 3, gy * cell + 3, cell - 6, cell - 6);
        }
      }
    },
    18,
    18
  );
  texturesToDispose.push(floorTex.map, floorTex.bumpMap);

  // 3. Military Crate Timber Bump + Fallback
  const crateTex = createProceduralTexturePair(
    maxAniso,
    (ctx, w, h) => {
      ctx.fillStyle = '#8f683c';
      ctx.fillRect(0, 0, w, h);
      for (let p = 0; p < 6; p++) {
        const py = (p * h) / 6;
        ctx.fillStyle = p % 2 === 0 ? '#9c7243' : '#825d34';
        ctx.fillRect(0, py + 3, w, h / 6 - 6);
      }
      ctx.strokeStyle = '#593c1e';
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, w - 18, h - 18);
    },
    (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      for (let p = 0; p < 6; p++) {
        const py = (p * h) / 6;
        ctx.fillStyle = '#181818';
        ctx.fillRect(0, py, w, 4);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 16;
      ctx.strokeRect(8, 8, w - 16, h - 16);
    },
    1,
    1
  );
  texturesToDispose.push(crateTex.map, crateTex.bumpMap);

  // 4. Concrete Jersey Barrier Texture
  const concreteTex = createProceduralTexturePair(
    maxAniso,
    (ctx, w, h) => {
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) {
        const cx = (i * 67) % w;
        const cy = (i * 113) % h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(45,50,58,0.22)' : 'rgba(235,240,245,0.18)';
        ctx.fillRect(cx, cy, 3, 3);
      }
      // Bottom hazard chevron band
      ctx.fillStyle = '#d97706';
      ctx.fillRect(0, h * 0.78, w, h * 0.16);
      ctx.fillStyle = '#18181b';
      for (let s = -w; s < w * 2; s += 44) {
        ctx.beginPath();
        ctx.moveTo(s, h * 0.78);
        ctx.lineTo(s + 22, h * 0.78);
        ctx.lineTo(s + 4, h * 0.94);
        ctx.lineTo(s - 18, h * 0.94);
        ctx.closePath();
        ctx.fill();
      }
    },
    (ctx, w, h) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        const cx = (i * 67) % w;
        const cy = (i * 113) % h;
        ctx.fillStyle = i % 2 === 0 ? '#383838' : '#d4d4d4';
        ctx.fillRect(cx, cy, 3, 3);
      }
    },
    1,
    1
  );
  texturesToDispose.push(concreteTex.map, concreteTex.bumpMap);

  // Radial Contact Shadow Texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  texturesToDispose.push(shadowTex);

  const sandstoneWall = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: sandstoneTex.map,
    bumpMap: sandstoneTex.bumpMap,
    bumpScale: 0.065,
    roughness: 0.84,
    metalness: 0.04,
  });

  const sandstoneTrim = new THREE.MeshStandardMaterial({
    color: 0xd8c39e,
    bumpMap: sandstoneTex.bumpMap,
    bumpScale: 0.03,
    roughness: 0.58,
    metalness: 0.1,
  });

  const courtyardFloor = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorTex.map,
    bumpMap: floorTex.bumpMap,
    bumpScale: 0.05,
    roughness: 0.82,
    metalness: 0.05,
  });

  const desertTerrain = new THREE.MeshStandardMaterial({
    color: 0xc8a97e,
    bumpMap: floorTex.bumpMap,
    bumpScale: 0.04,
    roughness: 0.92,
    metalness: 0.02,
  });

  const woodCrate = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: crateTex.map,
    bumpMap: crateTex.bumpMap,
    bumpScale: 0.055,
    roughness: 0.76,
    metalness: 0.08,
  });

  // Load high-resolution generated textures and bind seamlessly
  loader.load(SANDSTONE_IMAGE_URL, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAniso;
    sandstoneWall.map = tex;
    sandstoneWall.color.setHex(0xffffff);
    sandstoneWall.needsUpdate = true;
    texturesToDispose.push(tex);
  });

  loader.load(COBBLE_IMAGE_URL, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    tex.anisotropy = maxAniso;
    courtyardFloor.map = tex;
    courtyardFloor.color.setHex(0xffffff);
    courtyardFloor.needsUpdate = true;
    texturesToDispose.push(tex);
  });

  loader.load(WOOD_IMAGE_URL, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAniso;
    woodCrate.map = tex;
    woodCrate.color.setHex(0xffffff);
    woodCrate.needsUpdate = true;
    texturesToDispose.push(tex);
  });

  const woodFrame = new THREE.MeshStandardMaterial({
    color: 0x5c3d1e,
    roughness: 0.55,
    metalness: 0.16,
  });

  const concreteBarrier = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: concreteTex.map,
    bumpMap: concreteTex.bumpMap,
    bumpScale: 0.055,
    roughness: 0.82,
    metalness: 0.08,
  });

  const rebarSteel = new THREE.MeshStandardMaterial({
    color: 0x4b5563,
    roughness: 0.35,
    metalness: 0.85,
  });

  const explosiveBarrelRed = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.28,
    metalness: 0.72,
  });

  const hazardTrim = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.52,
    metalness: 0.25,
  });

  const ballisticGlass = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.08,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.88,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 0.95,
    ior: 1.52,
    thickness: 0.45,
    clearcoat: 1.0,
    depthWrite: false,
  });

  const gunmetalDark = new THREE.MeshStandardMaterial({
    color: 0x181c22,
    roughness: 0.28,
    metalness: 0.9,
  });

  const gunmetalBrushed = new THREE.MeshStandardMaterial({
    color: 0x3b4252,
    roughness: 0.2,
    metalness: 0.94,
  });

  const walnutStock = new THREE.MeshStandardMaterial({
    color: 0x6b3e23,
    roughness: 0.58,
    metalness: 0.08,
  });

  const olivePolymer = new THREE.MeshStandardMaterial({
    color: 0x3f4d36,
    roughness: 0.68,
    metalness: 0.15,
  });

  const brassCasing = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.22,
    metalness: 0.92,
  });

  const copperDomeMat = new THREE.MeshStandardMaterial({
    color: 0xb48a54,
    roughness: 0.34,
    metalness: 0.68,
  });

  const terracottaAwningMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.82,
    metalness: 0.05,
  });

  const sandbagMat = new THREE.MeshStandardMaterial({
    color: 0xb89f74,
    bumpMap: floorTex.bumpMap,
    bumpScale: 0.03,
    roughness: 0.9,
    metalness: 0.02,
  });

  const palmFoliageMat = new THREE.MeshStandardMaterial({
    color: 0x2f5233,
    roughness: 0.65,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });

  // 5. Ripstop Tactical Camo Weave + Micro-Grid Bump Map
  const camoProcedural = createProceduralTexturePair(
    maxAniso,
    (ctx, w, h) => {
      ctx.fillStyle = '#4a4e42';
      ctx.fillRect(0, 0, w, h);
      const patches = [
        { color: '#2b2f29', count: 28, rMin: 28, rMax: 78 },
        { color: '#6b634b', count: 24, rMin: 24, rMax: 68 },
        { color: '#394137', count: 26, rMin: 22, rMax: 64 },
        { color: '#7c7258', count: 18, rMin: 16, rMax: 46 },
      ];
      let seed = 17;
      for (const layer of patches) {
        ctx.fillStyle = layer.color;
        for (let i = 0; i < layer.count; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const cx = seed % w;
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const cy = seed % h;
          const rx = layer.rMin + (seed % (layer.rMax - layer.rMin));
          const ry = rx * 0.62;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, ((seed % 180) * Math.PI) / 180, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Ripstop crosshatch grid threads
      ctx.strokeStyle = 'rgba(18, 20, 16, 0.24)';
      ctx.lineWidth = 1;
      for (let g = 0; g < w; g += 8) {
        ctx.beginPath();
        ctx.moveTo(g, 0);
        ctx.lineTo(g, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, g);
        ctx.lineTo(w, g);
        ctx.stroke();
      }
    },
    (ctx, w, h) => {
      ctx.fillStyle = '#787878';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b8b8b8';
      ctx.lineWidth = 1.4;
      for (let g = 0; g < w; g += 8) {
        ctx.beginPath();
        ctx.moveTo(g, 0);
        ctx.lineTo(g, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, g);
        ctx.lineTo(w, g);
        ctx.stroke();
      }
      ctx.strokeStyle = '#383838';
      ctx.lineWidth = 1;
      for (let g = 4; g < w; g += 16) {
        ctx.beginPath();
        ctx.moveTo(g, 0);
        ctx.lineTo(g, h);
        ctx.stroke();
      }
    },
    2,
    2
  );
  texturesToDispose.push(camoProcedural.map, camoProcedural.bumpMap);

  // 6. Cordura 1000D MOLLE PALS Ballistic Plate Carrier Webbing Texture + Bump
  const molleTex = createProceduralTexturePair(
    maxAniso,
    (ctx, w, h) => {
      ctx.fillStyle = '#262925';
      ctx.fillRect(0, 0, w, h);
      // Horizontal PALS nylon webbing straps
      for (let y = 24; y < h; y += 52) {
        ctx.fillStyle = '#323630';
        ctx.fillRect(0, y, w, 28);
        ctx.fillStyle = '#191b18';
        ctx.fillRect(0, y + 28, w, 4);
        // Bar-tack vertical stitch seams every 64px
        ctx.fillStyle = '#474c44';
        for (let x = 16; x < w; x += 64) {
          ctx.fillRect(x, y + 2, 6, 24);
        }
      }
    },
    (ctx, w, h) => {
      ctx.fillStyle = '#505050';
      ctx.fillRect(0, 0, w, h);
      for (let y = 24; y < h; y += 52) {
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(0, y, w, 28);
        ctx.fillStyle = '#181818';
        ctx.fillRect(0, y + 28, w, 5);
        ctx.fillStyle = '#ffffff';
        for (let x = 16; x < w; x += 64) {
          ctx.fillRect(x, y + 2, 6, 24);
        }
      }
    },
    1.5,
    1.5
  );
  texturesToDispose.push(molleTex.map, molleTex.bumpMap);

  const activeCamoMap: THREE.Texture = camoProcedural.map;
  loader.load(CAMO_IMAGE_URL, (tex) => {
    if (tex.image) {
      const c = camoProcedural.map.image;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(tex.image as CanvasImageSource, 0, 0, c.width, c.height);
        camoProcedural.map.needsUpdate = true;
      }
    }
    texturesToDispose.push(tex);
  });

  const kevlarPlateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: molleTex.map,
    bumpMap: molleTex.bumpMap,
    bumpScale: 0.048,
    roughness: 0.62,
    metalness: 0.24,
  });

  const tacticalLeatherBootMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    bumpMap: camoProcedural.bumpMap,
    bumpScale: 0.025,
    roughness: 0.46,
    metalness: 0.18,
  });

  const balaclavaFabricMat = new THREE.MeshStandardMaterial({
    color: 0x1f2226,
    bumpMap: camoProcedural.bumpMap,
    bumpScale: 0.032,
    roughness: 0.78,
    metalness: 0.06,
  });

  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  materialsToDispose.push(
    sandstoneWall,
    sandstoneTrim,
    courtyardFloor,
    desertTerrain,
    woodCrate,
    woodFrame,
    concreteBarrier,
    rebarSteel,
    explosiveBarrelRed,
    hazardTrim,
    ballisticGlass,
    gunmetalDark,
    gunmetalBrushed,
    walnutStock,
    olivePolymer,
    brassCasing,
    copperDomeMat,
    terracottaAwningMat,
    sandbagMat,
    palmFoliageMat,
    kevlarPlateMat,
    tacticalLeatherBootMat,
    balaclavaFabricMat,
    contactShadowMat
  );

  const lib: TacticalMaterialLibrary = {
    sandstoneWall,
    sandstoneTrim,
    courtyardFloor,
    desertTerrain,
    woodCrate,
    woodFrame,
    concreteBarrier,
    rebarSteel,
    explosiveBarrelRed,
    hazardTrim,
    ballisticGlass,
    gunmetalDark,
    gunmetalBrushed,
    walnutStock,
    olivePolymer,
    brassCasing,
    copperDomeMat,
    terracottaAwningMat,
    sandbagMat,
    palmFoliageMat,
    get camoMap() {
      return activeCamoMap;
    },
    camoBumpMap: camoProcedural.bumpMap,
    kevlarPlateMat,
    tacticalLeatherBootMat,
    balaclavaFabricMat,
    contactShadowMat,
    dispose: () => {
      texturesToDispose.forEach((t) => t.dispose());
      materialsToDispose.forEach((m) => m.dispose());
    },
  };

  return lib;
}

export interface ViewmodelRig {
  root: THREE.Group;
  weaponModels: Record<WeaponId, THREE.Group>;
  muzzleFlash: THREE.Mesh;
  muzzleLight: THREE.PointLight;
}

export function createViewmodelWeaponRig(
  mats: TacticalMaterialLibrary,
  isSoftwareGl: boolean
): ViewmodelRig {
  const root = new THREE.Group();

  // 1. AK-47M Composite Model (12 parts with ExtrudeGeometry curved mag & Lathe barrel profile)
  const akGroup = new THREE.Group();
  const akReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.082, 0.34), mats.gunmetalDark);
  akReceiver.position.set(0, 0, -0.05);

  const akDustCover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.031, 0.033, 0.28, 10),
    mats.gunmetalBrushed
  );
  akDustCover.rotation.x = Math.PI / 2;
  akDustCover.position.set(0, 0.042, -0.04);

  const akStock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.092, 0.26), mats.walnutStock);
  akStock.position.set(0, -0.025, 0.22);
  akStock.rotation.x = -0.14;

  const akHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.068, 0.22), mats.walnutStock);
  akHandguard.position.set(0, 0.005, -0.32);

  const akBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.014, 0.44, 12),
    mats.gunmetalBrushed
  );
  akBarrel.rotation.x = Math.PI / 2;
  akBarrel.position.set(0, 0.018, -0.49);

  const akMuzzleBrake = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.015, 0.055, 10),
    mats.gunmetalDark
  );
  akMuzzleBrake.rotation.x = Math.PI / 2;
  akMuzzleBrake.position.set(0, 0.018, -0.71);

  const akGasTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.24, 8),
    mats.gunmetalDark
  );
  akGasTube.rotation.x = Math.PI / 2;
  akGasTube.position.set(0, 0.042, -0.34);

  // Curved Banana Magazine using ExtrudeGeometry
  const magShape = new THREE.Shape();
  magShape.moveTo(-0.032, 0);
  magShape.quadraticCurveTo(-0.042, -0.12, -0.085, -0.21);
  magShape.lineTo(-0.015, -0.23);
  magShape.quadraticCurveTo(0.025, -0.12, 0.034, 0);
  magShape.closePath();
  const magGeo = new THREE.ExtrudeGeometry(magShape, {
    depth: 0.038,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  magGeo.center();
  const akMag = new THREE.Mesh(magGeo, mats.hazardTrim);
  akMag.rotation.y = Math.PI / 2;
  akMag.position.set(0, -0.125, -0.15);

  const akGrip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.12, 0.055), mats.walnutStock);
  akGrip.position.set(0, -0.085, 0.05);
  akGrip.rotation.x = -0.28;

  const akFrontSight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.052, 0.025), mats.gunmetalDark);
  akFrontSight.position.set(0, 0.046, -0.65);

  const akRail = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.016, 0.16), mats.gunmetalDark);
  akRail.position.set(0, 0.062, -0.05);
  const akReflexFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.042, 0.05),
    mats.gunmetalBrushed
  );
  akReflexFrame.position.set(0, 0.082, -0.06);
  const akReflexDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.004, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  akReflexDot.position.set(0, 0.086, -0.06);

  akGroup.add(
    akReceiver,
    akDustCover,
    akStock,
    akHandguard,
    akBarrel,
    akMuzzleBrake,
    akGasTube,
    akMag,
    akGrip,
    akFrontSight,
    akRail,
    akReflexFrame,
    akReflexDot
  );

  // 2. USP-S Suppressed Tactical Pistol
  const uspGroup = new THREE.Group();
  const uspSlide = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.052, 0.22), mats.gunmetalBrushed);
  uspSlide.position.set(0, 0.025, -0.12);
  const uspFrame = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.032, 0.19), mats.gunmetalDark);
  uspFrame.position.set(0, -0.008, -0.1);
  const uspGrip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.13, 0.056), mats.olivePolymer);
  uspGrip.position.set(0, -0.075, -0.02);
  uspGrip.rotation.x = -0.24;
  const uspSuppressor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.021, 0.24, 14),
    mats.gunmetalDark
  );
  uspSuppressor.rotation.x = Math.PI / 2;
  uspSuppressor.position.set(0, 0.024, -0.35);
  const uspSight = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.012, 0.016),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  uspSight.position.set(0, 0.055, -0.03);
  uspGroup.add(uspSlide, uspFrame, uspGrip, uspSuppressor, uspSight);
  uspGroup.visible = false;

  // 3. AWP Magnum .338 Sniper
  const awpGroup = new THREE.Group();
  const awpChassis = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.095, 0.56), mats.olivePolymer);
  awpChassis.position.set(0, -0.01, -0.08);
  const awpStock = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.11, 0.28), mats.olivePolymer);
  awpStock.position.set(0, -0.025, 0.26);
  const awpBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.018, 0.64, 12),
    mats.gunmetalBrushed
  );
  awpBarrel.rotation.x = Math.PI / 2;
  awpBarrel.position.set(0, 0.028, -0.56);
  const awpBrake = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.032, 0.07), mats.gunmetalDark);
  awpBrake.position.set(0, 0.028, -0.88);
  const awpScopeTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12),
    mats.gunmetalDark
  );
  awpScopeTube.rotation.x = Math.PI / 2;
  awpScopeTube.position.set(0, 0.092, -0.14);
  const awpScopeBell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.024, 0.09, 12),
    mats.gunmetalBrushed
  );
  awpScopeBell.rotation.x = Math.PI / 2;
  awpScopeBell.position.set(0, 0.092, -0.32);
  const awpLens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), mats.ballisticGlass);
  awpLens.position.set(0, 0.092, 0.032);
  awpGroup.add(awpChassis, awpStock, awpBarrel, awpBrake, awpScopeTube, awpScopeBell, awpLens);
  awpGroup.visible = false;

  // 4. M67 HE Frag Grenade
  const heGroup = new THREE.Group();
  const heBody = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), mats.olivePolymer);
  heBody.position.set(0, -0.02, -0.22);
  const heNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.028, 0.045, 10),
    mats.brassCasing
  );
  heNeck.position.set(0, 0.055, -0.22);
  const heSpoon = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.095, 0.035), mats.gunmetalBrushed);
  heSpoon.position.set(0.045, 0.015, -0.22);
  heSpoon.rotation.z = -0.25;
  const heRing = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 8, 14), mats.brassCasing);
  heRing.position.set(-0.025, 0.06, -0.22);
  heGroup.add(heBody, heNeck, heSpoon, heRing);
  heGroup.visible = false;

  // Muzzle Flash Star
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), flashMat);
  muzzleFlash.scale.set(1.4, 1.4, 2.8);
  muzzleFlash.position.set(0, 0.03, -0.76);
  muzzleFlash.visible = false;

  const muzzleLight = new THREE.PointLight(0xf59e0b, 0, 8, 2);
  muzzleLight.position.set(0, 0.05, -0.75);
  if (isSoftwareGl) {
    muzzleLight.visible = false;
  }

  // Tactical Gloved Hands & Sleeves
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1f242b,
    roughness: 0.72,
    metalness: 0.12,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x3a4635,
    roughness: 0.85,
    metalness: 0.05,
  });
  const supportHand = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.054, 0.11), gloveMat);
  supportHand.position.set(-0.022, -0.025, -0.3);
  const supportForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.042, 0.26, 8),
    sleeveMat
  );
  supportForearm.rotation.x = Math.PI / 2 + 0.22;
  supportForearm.rotation.z = -0.28;
  supportForearm.position.set(-0.085, -0.08, -0.12);

  const triggerHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.062, 0.088), gloveMat);
  triggerHand.position.set(0.01, -0.06, 0.04);

  root.add(
    akGroup,
    uspGroup,
    awpGroup,
    heGroup,
    supportHand,
    supportForearm,
    triggerHand,
    muzzleFlash,
    muzzleLight
  );
  root.position.set(0.21, -0.18, -0.44);

  return {
    root,
    weaponModels: {
      ak47: akGroup,
      usp: uspGroup,
      awp: awpGroup,
      he_grenade: heGroup,
    },
    muzzleFlash,
    muzzleLight,
  };
}

export interface DestructiblePropVisual {
  group: THREE.Group;
  intactParts: THREE.Object3D[];
  crackedParts: THREE.Object3D[];
  breachedParts: THREE.Object3D[];
  updateDamageState: (state: CoverIntactState) => void;
}

// Helper for Lathe-profiled Ribbed Explosive Fuel Drum
function createRibbedBarrelGeometry(radius: number, height: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(radius * 0.96, 0),
    new THREE.Vector2(radius * 1.04, height * 0.03),
    new THREE.Vector2(radius * 0.97, height * 0.06),
    new THREE.Vector2(radius * 0.97, height * 0.31),
    new THREE.Vector2(radius * 1.05, height * 0.34), // Lower rolling hoop rib
    new THREE.Vector2(radius * 0.97, height * 0.37),
    new THREE.Vector2(radius * 0.97, height * 0.63),
    new THREE.Vector2(radius * 1.05, height * 0.66), // Upper rolling hoop rib
    new THREE.Vector2(radius * 0.97, height * 0.69),
    new THREE.Vector2(radius * 0.97, height * 0.94),
    new THREE.Vector2(radius * 1.04, height * 0.97),
    new THREE.Vector2(radius * 0.96, height),
    new THREE.Vector2(0, height),
  ];
  return new THREE.LatheGeometry(pts, 18);
}

// Helper for True Trapezoidal K-Rail Jersey Barrier Cross-Section using ExtrudeGeometry
function createJerseyProfileGeometry(
  length: number,
  height: number,
  baseDepth: number
): THREE.BufferGeometry {
  const hw = baseDepth * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, height * 0.14);
  shape.lineTo(hw * 0.56, height * 0.42);
  shape.lineTo(hw * 0.36, height);
  shape.lineTo(-hw * 0.36, height);
  shape.lineTo(-hw * 0.56, height * 0.42);
  shape.lineTo(-hw, height * 0.14);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  // Rotate so length is along X and cross-section is in Y-Z
  geo.rotateY(Math.PI / 2);
  geo.translate(-length * 0.5, 0, 0);
  applyWorldSpaceUVs(geo, 1.8);
  return geo;
}

export function createDestructibleProp(
  cover: DestructibleCoverState,
  mats: TacticalMaterialLibrary,
  isSoftwareGl: boolean
): DestructiblePropVisual {
  const group = new THREE.Group();
  group.position.set(cover.x, 0, cover.z);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(cover.width, cover.depth) * 0.72, 16),
    mats.contactShadowMat
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  const intactParts: THREE.Object3D[] = [];
  const crackedParts: THREE.Object3D[] = [];
  const breachedParts: THREE.Object3D[] = [];

  if (cover.type === 'wood_crate') {
    // 10-part composite military ordnance crate with recessed panels, diagonal cross-braces & iron corner brackets
    const lowerCore = new THREE.Mesh(
      new THREE.BoxGeometry(cover.width * 0.9, cover.height * 0.5, cover.depth * 0.9),
      mats.woodCrate
    );
    lowerCore.position.y = cover.height * 0.25;
    lowerCore.castShadow = !isSoftwareGl;
    lowerCore.receiveShadow = !isSoftwareGl;
    breachedParts.push(lowerCore);

    const upperHull = new THREE.Mesh(
      new THREE.BoxGeometry(cover.width * 0.92, cover.height * 0.5, cover.depth * 0.92),
      mats.woodCrate
    );
    upperHull.position.y = cover.height * 0.75;
    upperHull.castShadow = !isSoftwareGl;
    upperHull.receiveShadow = !isSoftwareGl;
    crackedParts.push(upperHull);

    // 4 Corner Battens + Diagonal Timber Braces + Iron Corner Brackets
    const battenOffsets = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];
    for (const [bx, bz] of battenOffsets) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, cover.height * 1.01, 0.14),
        mats.woodFrame
      );
      post.position.set(
        bx * (cover.width * 0.45),
        cover.height * 0.505,
        bz * (cover.depth * 0.45)
      );
      intactParts.push(post);
      group.add(post);

      const ironCorner = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, 0.18),
        mats.gunmetalDark
      );
      ironCorner.position.set(
        bx * (cover.width * 0.45),
        cover.height * 0.95,
        bz * (cover.depth * 0.45)
      );
      intactParts.push(ironCorner);
      group.add(ironCorner);
    }

    // Front & Back Diagonal Cross-Braces
    for (const sideZ of [-1, 1]) {
      const brace = new THREE.Mesh(
        new THREE.BoxGeometry(cover.width * 1.08, 0.11, 0.06),
        mats.woodFrame
      );
      brace.position.set(0, cover.height * 0.5, sideZ * (cover.depth * 0.46));
      brace.rotation.z = 0.72 * sideZ;
      intactParts.push(brace);
      group.add(brace);
    }

    group.add(lowerCore, upperHull);
  } else if (cover.type === 'concrete_barrier') {
    // True Highway K-Rail Jersey Barrier Profile (ExtrudeGeometry) + Internal Deformed Rebar Cage
    const baseKrail = new THREE.Mesh(
      createJerseyProfileGeometry(cover.width, cover.height * 0.55, cover.depth),
      mats.concreteBarrier
    );
    baseKrail.castShadow = !isSoftwareGl;
    baseKrail.receiveShadow = !isSoftwareGl;
    breachedParts.push(baseKrail);

    const midSlope = new THREE.Mesh(
      new THREE.BoxGeometry(cover.width * 0.96, cover.height * 0.26, cover.depth * 0.52),
      mats.concreteBarrier
    );
    midSlope.position.y = cover.height * 0.66;
    midSlope.castShadow = !isSoftwareGl;
    crackedParts.push(midSlope);

    const topCrest = new THREE.Mesh(
      new THREE.BoxGeometry(cover.width * 0.94, cover.height * 0.22, cover.depth * 0.38),
      mats.concreteBarrier
    );
    topCrest.position.y = cover.height * 0.89;
    intactParts.push(topCrest);

    // Internal steel rebar rods + lifting loops
    for (let i = -2; i <= 2; i++) {
      const rebar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, cover.height * 0.94, 6),
        mats.rebarSteel
      );
      rebar.position.set(i * (cover.width * 0.2), cover.height * 0.47, 0);
      breachedParts.push(rebar);
      group.add(rebar);
    }

    for (const lx of [-0.32, 0.32]) {
      const liftHook = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.02, 6, 12, Math.PI),
        mats.rebarSteel
      );
      liftHook.position.set(lx * cover.width, cover.height, 0);
      intactParts.push(liftHook);
      group.add(liftHook);
    }

    group.add(baseKrail, midSlope, topCrest);
  } else if (cover.type === 'explosive_barrel') {
    // Lathe-Profiled Ribbed Pressurized Fuel Drum
    const drumHull = new THREE.Mesh(
      createRibbedBarrelGeometry(cover.width * 0.48, cover.height),
      mats.explosiveBarrelRed
    );
    drumHull.castShadow = !isSoftwareGl;
    breachedParts.push(drumHull);

    const hazardBand = new THREE.Mesh(
      new THREE.CylinderGeometry(cover.width * 0.505, cover.width * 0.505, cover.height * 0.24, 18),
      mats.hazardTrim
    );
    hazardBand.position.y = cover.height * 0.5;
    crackedParts.push(hazardBand);

    const valveCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.09, 10),
      mats.brassCasing
    );
    valveCap.position.set(0.14, cover.height + 0.03, 0.1);
    intactParts.push(valveCap);

    const ventPlug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.07, 8),
      mats.gunmetalBrushed
    );
    ventPlug.position.set(-0.15, cover.height + 0.02, -0.08);
    intactParts.push(ventPlug);

    group.add(drumHull, hazardBand, valveCap, ventPlug);
  } else {
    // Ballistic Glass Tactical Partition with Extruded Steel Stanchions
    const frameBase = new THREE.Mesh(
      createJerseyProfileGeometry(cover.width, cover.height * 0.34, cover.depth * 1.15),
      mats.gunmetalDark
    );
    breachedParts.push(frameBase);

    const leftPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, cover.height, cover.depth * 1.1),
      mats.rebarSteel
    );
    leftPost.position.set(-cover.width * 0.46, cover.height * 0.5, 0);
    breachedParts.push(leftPost);

    const rightPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, cover.height, cover.depth * 1.1),
      mats.rebarSteel
    );
    rightPost.position.set(cover.width * 0.46, cover.height * 0.5, 0);
    breachedParts.push(rightPost);

    const topHeader = new THREE.Mesh(
      new THREE.BoxGeometry(cover.width, 0.12, cover.depth * 0.9),
      mats.gunmetalDark
    );
    topHeader.position.set(0, cover.height * 0.97, 0);
    crackedParts.push(topHeader);

    const glassPane = new THREE.Mesh(
      new THREE.BoxGeometry(cover.width * 0.84, cover.height * 0.62, cover.depth * 0.32),
      mats.ballisticGlass
    );
    glassPane.position.y = cover.height * 0.64;
    glassPane.renderOrder = 2;
    intactParts.push(glassPane);

    group.add(frameBase, leftPost, rightPost, topHeader, glassPane);
  }

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== shadow) {
      obj.userData.coverId = cover.id;
    }
  });

  const updateDamageState = (state: CoverIntactState) => {
    if (state === 'destroyed') {
      group.visible = false;
      return;
    }
    group.visible = true;
    intactParts.forEach((p) => {
      p.visible = state === 'intact';
    });
    crackedParts.forEach((p) => {
      p.visible = state === 'intact' || state === 'cracked';
    });
    breachedParts.forEach((p) => {
      p.visible = true;
    });
  };

  updateDamageState(cover.state);

  return {
    group,
    intactParts,
    crackedParts,
    breachedParts,
    updateDamageState,
  };
}

export interface EnemyVisualModel {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  headMesh: THREE.Mesh;
  shieldMesh: THREE.Mesh | null;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  weaponArmGroup: THREE.Group;
  telegraphRing: THREE.Mesh;
  telegraphLaser: THREE.Line;
  bodyMaterial: THREE.MeshStandardMaterial;
  headMaterial: THREE.MeshStandardMaterial;
}

// Sculpted LatheGeometry Anatomical Torso with Athletic V-Taper & World-Space Camo UVs
function createAnatomicalTorsoGeometry(widthScale: number, depthScale: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.01, -0.37),
    new THREE.Vector2(0.18, -0.36), // Pelvis base
    new THREE.Vector2(0.22, -0.26), // Hip line
    new THREE.Vector2(0.19, -0.14), // Tactical waist taper
    new THREE.Vector2(0.21, 0.0),   // Lower ribcage
    new THREE.Vector2(0.245, 0.16), // Upper chest / pectoral swell
    new THREE.Vector2(0.26, 0.27),  // Broad shoulder line
    new THREE.Vector2(0.18, 0.34),  // Trapezius slope
    new THREE.Vector2(0.11, 0.38),  // Collar ring
    new THREE.Vector2(0.01, 0.38),
  ];
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.scale(widthScale, 1.0, depthScale);
  applyWorldSpaceUVs(geo, 0.9);
  return geo;
}

// Extruded SAPI Ballistic Plate Carrier with Shooter's Cut Chamfered Corners
function createBallisticPlateCarrierGeometry(
  width: number,
  height: number,
  depth: number
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw * 0.88, -hh);
  shape.lineTo(hw * 0.88, -hh);
  shape.lineTo(hw, -hh * 0.45);
  shape.lineTo(hw, hh * 0.38);
  shape.lineTo(hw * 0.62, hh); // Shooter's cut upper right chamfer
  shape.lineTo(-hw * 0.62, hh); // Shooter's cut upper left chamfer
  shape.lineTo(-hw, hh * 0.38);
  shape.lineTo(-hw, -hh * 0.45);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -depth * 0.5);
  applyWorldSpaceUVs(geo, 0.65);
  return geo;
}

// Sculpted LatheGeometry High-Cut FAST / PASGT Ballistic Helmet Shell
function createSculptedHelmetGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.21, -0.06), // Flared lower brim
    new THREE.Vector2(0.228, -0.02),
    new THREE.Vector2(0.224, 0.04),
    new THREE.Vector2(0.205, 0.11),
    new THREE.Vector2(0.155, 0.165),
    new THREE.Vector2(0.08, 0.19),
    new THREE.Vector2(0.0, 0.198),  // Crown apex
  ];
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.scale(1.0, 1.0, 1.12);
  return geo;
}

// Curved Multi-Faceted ExtrudeGeometry Ballistic Assault Shield for heavy_shield Juggernaut
function createCurvedBallisticShieldGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Top-down curved U-channel cross-section
  shape.moveTo(-0.41, -0.08);
  shape.lineTo(-0.27, 0.045);
  shape.lineTo(0.27, 0.045);
  shape.lineTo(0.41, -0.08);
  shape.lineTo(0.36, -0.125);
  shape.lineTo(0.24, -0.015);
  shape.lineTo(-0.24, -0.015);
  shape.lineTo(-0.36, -0.125);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.24,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  // Rotate so extrusion height runs vertically along Y
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -0.62, 0);
  return geo;
}

export function createEnemyModel(
  enemyId: string,
  archetype: EnemyArchetype,
  mats: TacticalMaterialLibrary,
  isSoftwareGl: boolean
): EnemyVisualModel {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.72, 18), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  // Archetype-tuned Ripstop Camouflage Tint & High-Contrast Optic Accent
  const uniformTintHex =
    archetype === 'breacher'
      ? 0xb85d52 // Urban Assault Crimson-Charcoal Camo
      : archetype === 'marksman'
        ? 0x7c9a82 // Arid Sage-Recon Sniper Camo
        : archetype === 'heavy_shield'
          ? 0x646e78 // Titanium-Slate Juggernaut Weave
          : 0x9c8256; // Coyote-Ochre Spec-Ops Saboteur Camo

  const accentColor =
    archetype === 'breacher'
      ? 0xef4444
      : archetype === 'marksman'
        ? 0x38bdf8
        : archetype === 'heavy_shield'
          ? 0xf59e0b
          : 0x10b981;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: uniformTintHex,
    map: mats.camoMap,
    bumpMap: mats.camoBumpMap,
    bumpScale: 0.042,
    roughness: 0.72,
    metalness: 0.14,
  });

  const headMaterial = new THREE.MeshStandardMaterial({
    color: archetype === 'heavy_shield' ? 0x272c33 : 0x333932,
    bumpMap: mats.camoBumpMap,
    bumpScale: 0.03,
    roughness: 0.46,
    metalness: 0.36,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.78,
    roughness: 0.14,
    metalness: 0.88,
  });

  const skinBridgeMat = new THREE.MeshStandardMaterial({
    color: 0xc69c72,
    roughness: 0.65,
    metalness: 0.04,
  });

  // =========================================================================
  // 1 & 2. ARTICULATED HIP-PIVOTED LEGS (Thigh, Holster, Knee Pad, Calf, Boot)
  // =========================================================================
  function buildArticulatedLeg(isRight: boolean): THREE.Mesh {
    // Hip pivot mesh at y = 0.80m so leg rotation swings naturally from the hip socket
    const hipRoot = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 10, 10),
      bodyMaterial
    );
    hipRoot.position.set(isRight ? 0.145 : -0.145, 0.8, 0);

    // Sculpted Upper Thigh (CapsuleGeometry)
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.102, 0.24, 8, 12),
      bodyMaterial
    );
    thigh.position.set(0, -0.17, 0);
    hipRoot.add(thigh);

    // Thigh Tactical Rig: Drop-Leg Holster on Right Leg, Sub-Load Dump Pouch on Left Leg
    const thighStrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.108, 0.106, 0.055, 12),
      mats.gunmetalDark
    );
    thighStrap.position.set(0, -0.18, 0);
    hipRoot.add(thighStrap);

    if (isRight) {
      const holsterBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.18, 0.12),
        mats.kevlarPlateMat
      );
      holsterBody.position.set(0.095, -0.18, 0.02);
      const pistolGrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.08, 0.075),
        mats.gunmetalBrushed
      );
      pistolGrip.position.set(0.095, -0.08, -0.01);
      pistolGrip.rotation.x = 0.25;
      hipRoot.add(holsterBody, pistolGrip);
    } else {
      const dumpPouch = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.16, 0.13),
        mats.olivePolymer
      );
      dumpPouch.position.set(-0.095, -0.18, -0.01);
      hipRoot.add(dumpPouch);
    }

    // Contoured Hard-Shell Tactical Knee Pad
    const kneePad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.092, 0.14, 10, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
      mats.gunmetalDark
    );
    kneePad.position.set(0, -0.37, 0.025);
    const kneeCapPlate = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 10, 8),
      mats.kevlarPlateMat
    );
    kneeCapPlate.scale.set(1.05, 1.15, 0.55);
    kneeCapPlate.position.set(0, -0.37, 0.095);
    hipRoot.add(kneePad, kneeCapPlate);

    // Tapered Lower Shin / Bloused Combat Trouser Calf
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.074, 0.28, 12),
      bodyMaterial
    );
    shin.position.set(0, -0.53, -0.01);
    hipRoot.add(shin);

    // Multi-Part Laced Tactical Combat Boot (Ankle Collar, Vamp/Toe Box, Lugged Sole)
    const bootAnkle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.076, 0.082, 0.13, 12),
      mats.tacticalLeatherBootMat
    );
    bootAnkle.position.set(0, -0.69, -0.01);

    const bootVamp = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.068, 0.12, 8, 10),
      mats.tacticalLeatherBootMat
    );
    bootVamp.rotation.x = Math.PI / 2;
    bootVamp.scale.set(1.05, 1.0, 0.82);
    bootVamp.position.set(0, -0.735, 0.045);

    const bootSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.155, 0.036, 0.27),
      mats.gunmetalDark
    );
    bootSole.position.set(0, -0.78, 0.035);

    hipRoot.add(bootAnkle, bootVamp, bootSole);
    return hipRoot;
  }

  const leftLeg = buildArticulatedLeg(false);
  const rightLeg = buildArticulatedLeg(true);

  // =========================================================================
  // 3 & 4. SCULPTED ANATOMICAL TORSO, MOLLE PLATE CARRIER, POUCHES & BACKPACK
  // =========================================================================
  const isHeavy = archetype === 'heavy_shield';
  const torsoGeo = createAnatomicalTorsoGeometry(isHeavy ? 1.24 : 1.08, isHeavy ? 0.92 : 0.78);
  const bodyMesh = new THREE.Mesh(torsoGeo, bodyMaterial);
  bodyMesh.position.set(0, 1.14, 0);
  bodyMesh.castShadow = !isSoftwareGl;
  bodyMesh.receiveShadow = !isSoftwareGl;

  // Attach legs under bodyMesh or group; keep legs on group so walk-cycle rotation stays world-aligned,
  // and also add them to shootable hierarchy via bodyMesh or group traversal!
  // Let's attach all upper-body tactical equipment directly to bodyMesh (in local coords around y = 1.14m):
  const vestGeo = createBallisticPlateCarrierGeometry(
    isHeavy ? 0.54 : 0.46,
    0.52,
    isHeavy ? 0.36 : 0.31
  );
  const plateCarrier = new THREE.Mesh(vestGeo, mats.kevlarPlateMat);
  plateCarrier.position.set(0, 0.02, 0.01);
  plateCarrier.castShadow = !isSoftwareGl;
  bodyMesh.add(plateCarrier);

  // Archetype Identification Stripe & Patch on Upper Chest Plate
  const chestPatch = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.055, 0.02),
    visorMat
  );
  chestPatch.position.set(0, 0.17, isHeavy ? 0.195 : 0.17);
  bodyMesh.add(chestPatch);

  // 3 Individual Sculpted 3D Rifle Magazine Pouches with Retention Bungee Tabs
  for (let m = -1; m <= 1; m++) {
    const magPouch = new THREE.Mesh(
      new THREE.BoxGeometry(0.105, 0.19, 0.075),
      mats.olivePolymer
    );
    magPouch.position.set(m * 0.125, -0.07, isHeavy ? 0.21 : 0.185);

    const magTopPull = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.045, 0.055),
      mats.gunmetalBrushed
    );
    magTopPull.position.set(0, 0.11, 0);
    magPouch.add(magTopPull);
    bodyMesh.add(magPouch);
  }

  // Padded Battle Belt with M67 Frag Grenades & Trauma IFAK Pouch
  const battleBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(isHeavy ? 0.27 : 0.235, isHeavy ? 0.28 : 0.245, 0.1, 16),
    mats.kevlarPlateMat
  );
  battleBelt.scale.set(1.12, 1.0, 0.82);
  battleBelt.position.set(0, -0.28, 0);
  bodyMesh.add(battleBelt);

  for (const gx of [-0.18, 0.18]) {
    const fragCanister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.095, 10),
      mats.olivePolymer
    );
    fragCanister.position.set(gx, -0.26, 0.17);
    const fragSpoon = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.03, 0.02),
      mats.brassCasing
    );
    fragSpoon.position.set(0, 0.055, 0);
    fragCanister.add(fragSpoon);
    bodyMesh.add(fragCanister);
  }

  // Dorsal Tactical Hydration & Encrypted Radio Backpack + Whip Antenna
  const backPack = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.42, 0.15),
    mats.kevlarPlateMat
  );
  backPack.position.set(0, 0.03, isHeavy ? -0.23 : -0.205);
  const radioBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.22, 0.08),
    mats.gunmetalDark
  );
  radioBox.position.set(-0.11, 0.14, -0.06);
  const whipAntenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.011, 0.56, 6),
    mats.gunmetalBrushed
  );
  whipAntenna.position.set(-0.02, 0.36, 0);
  whipAntenna.rotation.z = 0.08;
  radioBox.add(whipAntenna);
  backPack.add(radioBox);
  bodyMesh.add(backPack);

  // Sculpted Deltoid Shoulder Pauldrons & Archetype Collar Gear
  for (const side of [-1, 1]) {
    const deltoidPad = new THREE.Mesh(
      new THREE.SphereGeometry(isHeavy ? 0.155 : 0.13, 12, 10),
      isHeavy ? mats.kevlarPlateMat : bodyMaterial
    );
    deltoidPad.scale.set(0.95, 1.15, 0.92);
    deltoidPad.position.set(side * (isHeavy ? 0.34 : 0.29), 0.22, 0);

    const brassardStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.12, 0.045, 12),
      visorMat
    );
    brassardStripe.position.set(0, -0.02, 0);
    deltoidPad.add(brassardStripe);
    bodyMesh.add(deltoidPad);
  }

  if (isHeavy) {
    // Armored EOD Ballistic Neck Gorget Collar for heavy_shield
    const gorget = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.24, 0.14, 16, 1, true),
      mats.kevlarPlateMat
    );
    gorget.position.set(0, 0.36, 0.01);
    bodyMesh.add(gorget);
  } else if (archetype === 'marksman') {
    // Sniper Ghillie / Tactical Hood Mantle Drape across Shoulders
    const hoodMantle = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.065, 8, 16),
      mats.olivePolymer
    );
    hoodMantle.rotation.x = Math.PI / 2;
    hoodMantle.scale.set(1.25, 0.95, 1.0);
    hoodMantle.position.set(0, 0.33, -0.01);
    bodyMesh.add(hoodMantle);
  } else if (archetype === 'saboteur') {
    // Saboteur Chest-Rigged C4 Demolitions Pack with Amber LED
    const demoPack = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.09, 0.05),
      mats.sandbagMat
    );
    demoPack.position.set(0.08, 0.14, 0.185);
    const demoLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 8, 8),
      visorMat
    );
    demoLed.position.set(0.03, 0.02, 0.028);
    demoPack.add(demoLed);
    bodyMesh.add(demoPack);
  }

  // Left Support Arm reaching across chest to support handguard
  const leftUpperArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.068, 0.22, 8, 10),
    bodyMaterial
  );
  leftUpperArm.position.set(-0.29, 0.07, 0.08);
  leftUpperArm.rotation.set(-0.65, 0, -0.32);

  const leftForearm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.058, 0.22, 8, 10),
    bodyMaterial
  );
  leftForearm.position.set(-0.14, -0.01, 0.28);
  leftForearm.rotation.set(-1.15, 0.48, 0);

  const leftGlove = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 8, 8),
    mats.tacticalLeatherBootMat
  );
  leftGlove.position.set(-0.02, 0.02, 0.42);
  bodyMesh.add(leftUpperArm, leftForearm, leftGlove);

  // =========================================================================
  // 5 & 6. SCULPTED HEAD, BALACLAVA, FAST HELMET & ARCHETYPE OPTICS / GAS MASK
  // =========================================================================
  const headMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.125, 0.11, 12, 16),
    mats.balaclavaFabricMat
  );
  headMesh.position.set(0, 1.66, 0);
  headMesh.castShadow = !isSoftwareGl;

  // Exposed Eye-Bridge / Brow Band between Balaclava & Helmet
  const browSkin = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.048, 0.08),
    skinBridgeMat
  );
  browSkin.position.set(0, 0.03, 0.095);
  headMesh.add(browSkin);

  // Sculpted High-Cut FAST / PASGT Ballistic Helmet Dome
  const helmetShell = new THREE.Mesh(createSculptedHelmetGeometry(), headMaterial);
  helmetShell.position.set(0, 0.04, -0.01);
  helmetShell.castShadow = !isSoftwareGl;
  headMesh.add(helmetShell);

  // Side ARC Accessory Rails & Peltor Comms Headset Ear-Cups
  for (const side of [-1, 1]) {
    const arcRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.045, 0.18),
      mats.gunmetalBrushed
    );
    arcRail.position.set(side * 0.21, 0.06, 0.01);

    const earCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.058, 0.045, 12),
      mats.olivePolymer
    );
    earCup.rotation.z = Math.PI / 2;
    earCup.position.set(side * 0.145, -0.01, -0.01);
    headMesh.add(arcRail, earCup);
  }

  // Front Wilcox NVG Mount Shroud + Rear Battery Counterweight Pouch
  const nvgShroud = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.065, 0.035),
    mats.gunmetalBrushed
  );
  nvgShroud.position.set(0, 0.11, 0.205);
  const counterweight = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.07, 0.045),
    mats.kevlarPlateMat
  );
  counterweight.position.set(0, 0.06, -0.22);
  headMesh.add(nvgShroud, counterweight);

  // Archetype-Specific Tactical Face Gear & Illuminated Optics
  if (archetype === 'breacher') {
    // Wrap-Around Ballistic Goggles + Dual-Canister CBRN Gas Mask Respirator
    const gogglesFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.08, 0.12),
      mats.gunmetalDark
    );
    gogglesFrame.position.set(0, 0.035, 0.11);
    const gogglesLens = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.062, 0.128),
      visorMat
    );
    gogglesLens.position.set(0, 0.035, 0.112);

    const snoutMask = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.072, 0.12, 10),
      mats.gunmetalDark
    );
    snoutMask.rotation.x = Math.PI * 0.38;
    snoutMask.position.set(0, -0.055, 0.13);

    for (const side of [-1, 1]) {
      const canister = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.044, 0.075, 10),
        mats.olivePolymer
      );
      canister.rotation.z = side * 0.65;
      canister.rotation.x = 0.45;
      canister.position.set(side * 0.095, -0.065, 0.12);
      headMesh.add(canister);
    }
    headMesh.add(gogglesFrame, gogglesLens, snoutMask);
  } else if (archetype === 'marksman') {
    // Quad-Tube Panoramic Night Vision Goggles (GPNVG-18 with 4 glowing cyan lenses)
    const nvgBridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.042, 0.08),
      mats.gunmetalDark
    );
    nvgBridge.position.set(0, 0.055, 0.155);
    headMesh.add(nvgBridge);

    for (const lx of [-0.095, -0.034, 0.034, 0.095]) {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.026, 0.11, 10),
        mats.gunmetalBrushed
      );
      tube.rotation.x = Math.PI / 2;
      tube.position.set(lx, 0.035, 0.185);

      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.021, 10),
        visorMat
      );
      lens.position.set(0, -0.056, 0);
      lens.rotation.x = Math.PI / 2;
      tube.add(lens);
      headMesh.add(tube);
    }
  } else if (archetype === 'heavy_shield') {
    // Altyn / K6-3 Heavy Titanium Face-Shield Blast Visor with Glowing Amber Slit
    const blastVisor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.215, 0.22, 0.22, 16, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
      mats.gunmetalBrushed
    );
    blastVisor.position.set(0, 0.01, 0.02);

    const visionSlit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.222, 0.222, 0.042, 14, 1, false, -Math.PI * 0.32, Math.PI * 0.64),
      visorMat
    );
    visionSlit.position.set(0, 0.035, 0.022);
    headMesh.add(blastVisor, visionSlit);
  } else {
    // Saboteur Dual-Tube PVS-31 Binocular NVGs (2 glowing emerald lenses) + Boom Mic
    for (const lx of [-0.052, 0.052]) {
      const binoTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.032, 0.115, 12),
        mats.gunmetalDark
      );
      binoTube.rotation.x = Math.PI / 2;
      binoTube.position.set(lx, 0.035, 0.18);

      const binoLens = new THREE.Mesh(
        new THREE.CircleGeometry(0.026, 12),
        visorMat
      );
      binoLens.position.set(0, -0.059, 0);
      binoLens.rotation.x = Math.PI / 2;
      binoTube.add(binoLens);
      headMesh.add(binoTube);
    }
  }

  // =========================================================================
  // 7. ARTICULATED WEAPON ARM & DETAILED 3D ARCHETYPE FIREARM RIG
  // =========================================================================
  const weaponArmGroup = new THREE.Group();
  weaponArmGroup.position.set(0.26, 1.24, 0.12);

  const rightBicep = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.068, 0.2, 8, 10),
    bodyMaterial
  );
  rightBicep.position.set(0.02, -0.02, 0.04);
  rightBicep.rotation.x = -0.55;

  const rightForearm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.058, 0.22, 8, 10),
    bodyMaterial
  );
  rightForearm.position.set(-0.02, -0.06, 0.2);
  rightForearm.rotation.x = -1.35;

  const rightGlove = new THREE.Mesh(
    new THREE.SphereGeometry(0.056, 8, 8),
    mats.tacticalLeatherBootMat
  );
  rightGlove.position.set(-0.04, -0.04, 0.32);

  // Detailed Multi-Part 3D Firearm scaled per Archetype
  const gunGroup = new THREE.Group();
  gunGroup.position.set(-0.05, -0.01, 0.34);

  const receiverLen = archetype === 'marksman' ? 0.44 : archetype === 'breacher' ? 0.32 : 0.38;
  const gunReceiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.105, receiverLen),
    mats.gunmetalDark
  );
  const gunStock = new THREE.Mesh(
    new THREE.BoxGeometry(0.052, 0.095, 0.22),
    archetype === 'breacher' ? mats.walnutStock : mats.olivePolymer
  );
  gunStock.position.set(0, -0.015, -receiverLen * 0.5 - 0.09);

  const barrelLen = archetype === 'marksman' ? 0.52 : archetype === 'saboteur' ? 0.42 : 0.32;
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.02, barrelLen, 10),
    mats.gunmetalBrushed
  );
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.025, receiverLen * 0.5 + barrelLen * 0.45);

  const gunMag = new THREE.Mesh(
    new THREE.BoxGeometry(0.048, 0.18, 0.085),
    archetype === 'breacher' ? mats.brassCasing : mats.gunmetalBrushed
  );
  gunMag.position.set(0, -0.11, 0.05);
  gunMag.rotation.x = 0.28;

  const gunOptic = new THREE.Mesh(
    new THREE.CylinderGeometry(
      archetype === 'marksman' ? 0.028 : 0.022,
      archetype === 'marksman' ? 0.028 : 0.022,
      archetype === 'marksman' ? 0.24 : 0.11,
      10
    ),
    mats.gunmetalBrushed
  );
  gunOptic.rotation.x = Math.PI / 2;
  gunOptic.position.set(0, 0.078, 0.02);

  gunGroup.add(gunReceiver, gunStock, gunBarrel, gunMag, gunOptic);

  if (archetype === 'saboteur') {
    const suppressor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.2, 12),
      mats.gunmetalDark
    );
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.025, receiverLen * 0.5 + barrelLen * 0.85);
    gunGroup.add(suppressor);
  }

  weaponArmGroup.add(rightBicep, rightForearm, rightGlove, gunGroup);

  // =========================================================================
  // 8. CURVED EXTRUDED BALLISTIC ASSAULT SHIELD FOR HEAVY_SHIELD ARCHETYPE
  // =========================================================================
  let shieldMesh: THREE.Mesh | null = null;
  if (archetype === 'heavy_shield') {
    shieldMesh = new THREE.Mesh(
      createCurvedBallisticShieldGeometry(),
      mats.gunmetalBrushed
    );
    shieldMesh.position.set(-0.1, 0.96, 0.4);
    shieldMesh.castShadow = !isSoftwareGl;

    const shieldViewportFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.22, 0.09),
      mats.gunmetalDark
    );
    shieldViewportFrame.position.set(0, 0.28, 0.03);

    const shieldViewportGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.15, 0.11),
      mats.ballisticGlass
    );
    shieldViewportGlass.position.set(0, 0.28, 0.035);

    const shieldHazardBanner = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.09, 0.08),
      mats.hazardTrim
    );
    shieldHazardBanner.position.set(0, -0.22, 0.03);

    shieldMesh.add(shieldViewportFrame, shieldViewportGlass, shieldHazardBanner);
    shieldMesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData = { enemyId, hitZone: 'shield' };
      }
    });
    group.add(shieldMesh);
  }

  // =========================================================================
  // 9. WINDUP ATTACK TELEGRAPH GROUND RING & SIGHT LASER
  // =========================================================================
  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.92, 24),
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.03;
  telegraphRing.visible = false;

  const laserGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0.21, 1.26, 0.55),
    new THREE.Vector3(0.21, 1.26, 22),
  ]);
  const telegraphLaser = new THREE.Line(
    laserGeo,
    new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 })
  );
  telegraphLaser.visible = false;

  // Tag all meshes in each anatomical hitzone hierarchy so raycasting works on any sub-part!
  const tagHitZone = (rootObj: THREE.Object3D, hitZone: 'body' | 'head') => {
    rootObj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData = { enemyId, hitZone };
      }
    });
  };
  tagHitZone(bodyMesh, 'body');
  tagHitZone(leftLeg, 'body');
  tagHitZone(rightLeg, 'body');
  tagHitZone(weaponArmGroup, 'body');
  tagHitZone(headMesh, 'head');

  group.add(
    leftLeg,
    rightLeg,
    bodyMesh,
    headMesh,
    weaponArmGroup,
    telegraphRing,
    telegraphLaser
  );

  return {
    group,
    bodyMesh,
    headMesh,
    shieldMesh,
    leftLeg,
    rightLeg,
    weaponArmGroup,
    telegraphRing,
    telegraphLaser,
    bodyMaterial,
    headMaterial,
  };
}

export interface C4VisualRig {
  group: THREE.Group;
  beaconMesh: THREE.Mesh;
  beaconLight: THREE.PointLight;
}

export function createC4BombGroup(
  x: number,
  z: number,
  mats: TacticalMaterialLibrary,
  isSoftwareGl: boolean
): C4VisualRig {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Bombsite A Octagonal Tiered Monument Pedestal + Sandbag Ring + C4 Ordnance Satchel
  const lowerOctagon = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.5, 0.22, 8),
    mats.sandstoneTrim
  );
  lowerOctagon.position.y = 0.11;
  lowerOctagon.receiveShadow = !isSoftwareGl;

  const upperOctagon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.8, 0.22, 8),
    mats.sandstoneWall
  );
  upperOctagon.position.y = 0.33;
  upperOctagon.receiveShadow = !isSoftwareGl;

  // Sandbag defensive low wall on East/West edges of pedestal
  for (const sx of [-1.85, 1.85]) {
    for (let row = 0; row < 2; row++) {
      const bag = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.16, 0.52, 6, 10),
        mats.sandbagMat
      );
      bag.rotation.x = Math.PI / 2;
      bag.position.set(sx, 0.28 + row * 0.22, 0);
      group.add(bag);
    }
  }

  const crateBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.52, 0.88), mats.olivePolymer);
  crateBase.position.y = 0.7;

  const c4BlockLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.22), mats.hazardTrim);
  c4BlockLeft.position.set(-0.14, 1.0, 0);
  const c4BlockRight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.22), mats.hazardTrim);
  c4BlockRight.position.set(0.14, 1.0, 0);

  const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.18), mats.gunmetalDark);
  keypad.position.set(0, 1.02, 0.04);

  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), beaconMat);
  beaconMesh.position.set(0, 1.14, 0);

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6),
    mats.gunmetalBrushed
  );
  antenna.position.set(0.22, 1.2, -0.1);

  const beaconLight = new THREE.PointLight(0xef4444, 1.8, 10, 2);
  beaconLight.position.set(0, 1.38, 0);
  if (isSoftwareGl) {
    beaconLight.visible = false;
  }

  const siteRing = new THREE.Mesh(
    new THREE.RingGeometry(2.9, 3.25, 32),
    new THREE.MeshBasicMaterial({
      color: 0xd97706,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  siteRing.rotation.x = -Math.PI / 2;
  siteRing.position.y = 0.022;

  group.add(
    lowerOctagon,
    upperOctagon,
    crateBase,
    c4BlockLeft,
    c4BlockRight,
    keypad,
    beaconMesh,
    antenna,
    beaconLight,
    siteRing
  );

  return { group, beaconMesh, beaconLight };
}

/**
 * Creates a classical turned stone column (`THREE.LatheGeometry`) with plinth base,
 * entasis shaft, and flared echinus/abacus capital.
 */
function createTurnedStoneColumn(height: number, mats: TacticalMaterialLibrary): THREE.Group {
  const colGroup = new THREE.Group();
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.55, 0),
    new THREE.Vector2(0.55, 0.22),
    new THREE.Vector2(0.46, 0.35),
    new THREE.Vector2(0.38, 0.45),
    new THREE.Vector2(0.34, height - 0.55),
    new THREE.Vector2(0.44, height - 0.32),
    new THREE.Vector2(0.56, height - 0.16),
    new THREE.Vector2(0.56, height),
    new THREE.Vector2(0, height),
  ];
  const latheGeo = new THREE.LatheGeometry(profile, 16);
  const colMesh = new THREE.Mesh(latheGeo, mats.sandstoneTrim);
  colGroup.add(colMesh);
  return colGroup;
}

/**
 * Creates a true beveled Vaulted Stone Archway Span using `THREE.ExtrudeGeometry`
 * with a semicircular arch opening, extruded keystone, and overhanging cornice molding.
 */
function createVaultedArchwaySpan(
  spanWidth: number,
  totalHeight: number,
  depth: number,
  archRadius: number,
  mats: TacticalMaterialLibrary,
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();
  const hw = spanWidth * 0.5;
  const springY = totalHeight - archRadius - 0.85;

  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-archRadius, 0);
  shape.lineTo(-archRadius, springY);
  shape.absarc(0, springY, archRadius, Math.PI, 0, true);
  shape.lineTo(archRadius, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, totalHeight);
  shape.lineTo(-hw, totalHeight);
  shape.closePath();

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 3,
    curveSegments: 20,
  });
  extrudeGeo.translate(0, 0, -depth * 0.5);
  applyWorldSpaceUVs(extrudeGeo, 2.8);

  const archWallMesh = new THREE.Mesh(extrudeGeo, mats.sandstoneWall);
  archWallMesh.castShadow = !isSoftwareGl;
  archWallMesh.receiveShadow = !isSoftwareGl;
  group.add(archWallMesh);

  // Keystone & Voussoir Trim Blocks around the arch crown
  const keystone = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.68, depth + 0.28),
    mats.sandstoneTrim
  );
  keystone.position.set(0, springY + archRadius + 0.08, 0);
  group.add(keystone);

  // Top Overhanging Cornice Molding
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(spanWidth + 0.45, 0.36, depth + 0.45),
    mats.sandstoneTrim
  );
  cornice.position.set(0, totalHeight + 0.18, 0);
  group.add(cornice);

  // Turned Columns flanking the archway opening
  for (const side of [-1, 1]) {
    const col = createTurnedStoneColumn(springY + 0.25, mats);
    col.position.set(side * (archRadius + 0.22), 0, depth * 0.48);
    const colBack = createTurnedStoneColumn(springY + 0.25, mats);
    colBack.position.set(side * (archRadius + 0.22), 0, -depth * 0.48);
    group.add(col, colBack);
  }

  return group;
}

/**
 * Creates a composite 8-part Mediterranean Date Palm Tree (`TubeGeometry` curved trunk + extruded frond crown)
 * inside an octagonal sandstone planter.
 */
function createPalmPlanterGroup(
  x: number,
  z: number,
  mats: TacticalMaterialLibrary
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Octagonal Sandstone Planter Box
  const planterBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.05, 0.65, 8),
    mats.sandstoneTrim
  );
  planterBase.position.y = 0.325;
  group.add(planterBase);

  // Curved Palm Trunk via TubeGeometry
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.5, 0),
    new THREE.Vector3(0.18, 2.2, 0.1),
    new THREE.Vector3(0.05, 4.1, -0.08),
    new THREE.Vector3(-0.1, 5.8, 0),
  ]);
  const trunkGeo = new THREE.TubeGeometry(curve, 12, 0.22, 8, false);
  const trunkMesh = new THREE.Mesh(trunkGeo, mats.woodFrame);
  group.add(trunkMesh);

  // 7 Drooping Palm Fronds at Crown
  const frondShape = new THREE.Shape();
  frondShape.moveTo(0, 0);
  frondShape.quadraticCurveTo(0.28, 1.1, 0, 2.4);
  frondShape.quadraticCurveTo(-0.28, 1.1, 0, 0);
  const frondGeo = new THREE.ShapeGeometry(frondShape, 8);
  frondGeo.rotateX(Math.PI * 0.38);

  for (let f = 0; f < 7; f++) {
    const frond = new THREE.Mesh(frondGeo, mats.palmFoliageMat);
    frond.position.set(-0.1, 5.75, 0);
    frond.rotation.y = (f * Math.PI * 2) / 7;
    group.add(frond);
  }

  return group;
}

export interface CompoundEnvironment {
  wallColliders: AABB2D[];
  raycastWallMeshes: THREE.Mesh[];
}

export function createCompoundEnvironment(
  scene: THREE.Scene,
  mats: TacticalMaterialLibrary,
  isSoftwareGl: boolean
): CompoundEnvironment {
  const wallColliders: AABB2D[] = [];
  const raycastWallMeshes: THREE.Mesh[] = [];

  // 0. Procedural Atmospheric Sky Dome with Solar Halo & Horizon Haze
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 128;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d')!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, '#1e3a5f');
  skyGrad.addColorStop(0.28, '#3b6998');
  skyGrad.addColorStop(0.46, '#8ab0ca');
  skyGrad.addColorStop(0.54, '#e2ceb0');
  skyGrad.addColorStop(1, '#c8a97e');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 128, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(155, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(skyDome);

  // 1. Extended Desert Floor outside compound + Inner Tactical Courtyard Cobblestone Floor
  const outerDesert = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mats.desertTerrain);
  outerDesert.rotation.x = -Math.PI / 2;
  outerDesert.position.y = -0.03;
  scene.add(outerDesert);

  const courtyard = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), mats.courtyardFloor);
  courtyard.rotation.x = -Math.PI / 2;
  courtyard.position.y = 0;
  courtyard.receiveShadow = !isSoftwareGl;
  scene.add(courtyard);
  raycastWallMeshes.push(courtyard);

  // Tactical Sandstone Curb Lines framing the Central Courtyard Lane (offset Y >= 0.015 so cobblestone floor stays 100% visible)
  for (const curbX of [-2.1, 2.1]) {
    const curbLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.025, 32),
      mats.sandstoneTrim
    );
    curbLine.position.set(curbX, 0.014, 2);
    scene.add(curbLine);
  }

  const addCompoundWall = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    withArchDetails = true
  ) => {
    const wallGroup = new THREE.Group();
    wallGroup.position.set(x, 0, z);

    const wallGeo = new THREE.BoxGeometry(w, h, d);
    applyWorldSpaceUVs(wallGeo, 2.8);
    const mainWall = new THREE.Mesh(wallGeo, mats.sandstoneWall);
    mainWall.position.y = h * 0.5;
    mainWall.castShadow = !isSoftwareGl;
    mainWall.receiveShadow = !isSoftwareGl;
    wallGroup.add(mainWall);
    raycastWallMeshes.push(mainWall);

    if (withArchDetails) {
      // Stepped Crown Cornice + Crenellated Merlons + Base Plinth
      const coping = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.32, 0.36, d + 0.32),
        mats.sandstoneTrim
      );
      coping.position.y = h + 0.18;
      wallGroup.add(coping);

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.22, 0.38, d + 0.22),
        mats.sandstoneTrim
      );
      plinth.position.y = 0.19;
      wallGroup.add(plinth);

      // Architectural Arched Recessed Windows, Stone Sills & Sloped Terracotta Bazaar Awnings
      const span = Math.max(w, d);
      if (span >= 8) {
        const isAlongX = w > d;
        const count = Math.floor(span / 7.5);
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) * 0.5) * 7.2;

          // Deep Window Alcove + Arched Top Header
          const recess = new THREE.Mesh(
            new THREE.BoxGeometry(isAlongX ? 1.5 : w + 0.14, 1.55, isAlongX ? d + 0.14 : 1.5),
            mats.gunmetalDark
          );
          recess.position.set(isAlongX ? offset : 0, h * 0.62, isAlongX ? 0 : offset);
          wallGroup.add(recess);

          const sill = new THREE.Mesh(
            new THREE.BoxGeometry(isAlongX ? 1.85 : w + 0.36, 0.18, isAlongX ? d + 0.36 : 1.85),
            mats.sandstoneTrim
          );
          sill.position.set(isAlongX ? offset : 0, h * 0.62 - 0.82, isAlongX ? 0 : offset);
          wallGroup.add(sill);

          // Sloped Terracotta Sun Awning on alternating bays
          if (i % 2 === 0) {
            const awning = new THREE.Mesh(
              new THREE.BoxGeometry(isAlongX ? 2.4 : w + 1.4, 0.12, isAlongX ? d + 1.4 : 2.4),
              mats.terracottaAwningMat
            );
            awning.position.set(isAlongX ? offset : 0, h * 0.78, isAlongX ? 0 : offset);
            if (isAlongX) awning.rotation.x = z < 0 ? 0.28 : -0.28;
            else awning.rotation.z = x < 0 ? -0.28 : 0.28;
            wallGroup.add(awning);
          }

          // Vertical Pilaster Buttress between bays
          if (i < count - 1) {
            const pilasterOffset = offset + 3.6;
            const pilaster = new THREE.Mesh(
              new THREE.BoxGeometry(isAlongX ? 0.55 : w + 0.28, h, isAlongX ? d + 0.28 : 0.55),
              mats.sandstoneTrim
            );
            pilaster.position.set(
              isAlongX ? pilasterOffset : 0,
              h * 0.5,
              isAlongX ? 0 : pilasterOffset
            );
            wallGroup.add(pilaster);
          }
        }
      }
    }

    scene.add(wallGroup);
    wallColliders.push({
      minX: x - w * 0.5,
      maxX: x + w * 0.5,
      minZ: z - d * 0.5,
      maxZ: z + d * 0.5,
    });
  };

  // Compound Perimeter Walls (60m x 60m tactical arena)
  addCompoundWall(0, -28, 58, 5.4, 2.0); // North Wall
  addCompoundWall(0, 28, 58, 4.8, 2.0); // South Wall
  addCompoundWall(-28, 0, 2.0, 5.2, 56); // West Wall
  addCompoundWall(28, 0, 2.0, 5.2, 56); // East Wall

  // Interior Partition Colonades
  addCompoundWall(-13, -6, 3.2, 4.8, 8.5);
  addCompoundWall(-13, 9, 3.2, 4.8, 6.5);
  addCompoundWall(13, -5, 3.2, 4.8, 9.0);
  addCompoundWall(13, 10, 3.2, 4.8, 6.0);

  // 2. Sculpted Vaulted Stone Archways (`ExtrudeGeometry` with semicircular arches & turned Lathe columns)
  // Left & Right Courtyard Arch Portals at Z = 9.5
  const leftCourtyardArch = createVaultedArchwaySpan(8.2, 5.2, 1.4, 2.6, mats, isSoftwareGl);
  leftCourtyardArch.position.set(-7.5, 0, 9.5);
  scene.add(leftCourtyardArch);

  const rightCourtyardArch = createVaultedArchwaySpan(8.2, 5.2, 1.4, 2.6, mats, isSoftwareGl);
  rightCourtyardArch.position.set(7.5, 0, 9.5);
  scene.add(rightCourtyardArch);

  // Central Monumental Triumphal Arch Span framing Bombsite A at Z = -2.5
  const centerHighArch = createVaultedArchwaySpan(11.5, 6.4, 1.5, 4.2, mats, isSoftwareGl);
  centerHighArch.position.set(0, 0, -2.5);
  scene.add(centerHighArch);

  // Overhead Wooden Pergola Sun-Slats across West & East Flank Connectors
  for (let s = -14; s <= 14; s += 2.8) {
    const westBeam = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 0.32), mats.woodFrame);
    westBeam.position.set(-20.5, 4.85, s);
    const eastBeam = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 0.32), mats.woodFrame);
    eastBeam.position.set(20.5, 4.85, s);
    scene.add(westBeam, eastBeam);
  }

  // Industrial Steel Conduit Pipes (`TubeGeometry`) along Partition Walls
  for (const sideX of [-11.2, 11.2]) {
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sideX, 3.6, 12),
      new THREE.Vector3(sideX, 3.6, -9),
      new THREE.Vector3(sideX, 1.2, -9.8),
    ]);
    const pipeGeo = new THREE.TubeGeometry(pipeCurve, 16, 0.09, 8, false);
    const pipeMesh = new THREE.Mesh(pipeGeo, mats.rebarSteel);
    scene.add(pipeMesh);
  }

  // Mediterranean Date Palm Planters in Safe Corner Alcoves
  scene.add(createPalmPlanterGroup(-23.5, 22.5, mats));
  scene.add(createPalmPlanterGroup(23.5, 22.5, mats));
  scene.add(createPalmPlanterGroup(-23.5, -22.5, mats));
  scene.add(createPalmPlanterGroup(23.5, -22.5, mats));

  // 3. Bombsite A Citadel Sanctuary, Ribbed Golden-Copper Dome (`LatheGeometry`) & Tall Minaret Tower
  const citadelGroup = new THREE.Group();
  citadelGroup.position.set(0, 0, -25.5);

  const towerBaseGeo = new THREE.BoxGeometry(11.5, 8.2, 4.8);
  applyWorldSpaceUVs(towerBaseGeo, 2.8);
  const towerBase = new THREE.Mesh(towerBaseGeo, mats.sandstoneWall);
  towerBase.position.y = 4.1;

  const towerCrown = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.7, 5.4), mats.sandstoneTrim);
  towerCrown.position.y = 8.45;

  // Octagonal Drum Base under the Dome
  const octDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 4.0, 1.8, 8),
    mats.sandstoneTrim
  );
  octDrum.position.y = 9.4;

  // Lathe-Turned Pointed Moorish Dome Profile + 12 Meridian Ribs + Crescent Finial Spire
  const domePts: THREE.Vector2[] = [
    new THREE.Vector2(3.65, 0),
    new THREE.Vector2(3.75, 0.7),
    new THREE.Vector2(3.4, 1.8),
    new THREE.Vector2(2.4, 3.0),
    new THREE.Vector2(1.1, 3.9),
    new THREE.Vector2(0.18, 4.4),
    new THREE.Vector2(0.05, 5.6),
    new THREE.Vector2(0, 5.8),
  ];
  const domeGeo = new THREE.LatheGeometry(domePts, 24);
  const towerDome = new THREE.Mesh(domeGeo, mats.copperDomeMat);
  towerDome.position.y = 10.2;

  // Flanking Tall Minaret Tower (at X = 8.2, Z = -25.5)
  const minaretGroup = new THREE.Group();
  minaretGroup.position.set(8.5, 0, 0);
  const minBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 6.5, 3.2), mats.sandstoneWall);
  minBase.position.y = 3.25;
  const minShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.45, 7.5, 12),
    mats.sandstoneWall
  );
  minShaft.position.y = 10.0;
  const minBalcony = new THREE.Mesh(
    new THREE.CylinderGeometry(1.85, 1.35, 0.75, 12),
    mats.sandstoneTrim
  );
  minBalcony.position.y = 13.8;
  const minLantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 2.2, 8),
    mats.gunmetalDark
  );
  minLantern.position.y = 15.1;
  const minSpire = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 2.8, 12),
    mats.copperDomeMat
  );
  minSpire.position.y = 17.5;
  minaretGroup.add(minBase, minShaft, minBalcony, minLantern, minSpire);

  citadelGroup.add(towerBase, towerCrown, octDrum, towerDome, minaretGroup);
  scene.add(citadelGroup);

  // 4. Sculpted Stepped Sandstone Canyon Mesas & Distant Domes outside the compound
  const cliffCoords = [
    [-55, -60, 28, 18, 22],
    [52, -65, 34, 22, 24],
    [-68, 15, 24, 15, 38],
    [68, 20, 26, 16, 36],
    [0, -78, 48, 24, 20],
  ];
  for (const [cx, cz, cw, ch, cd] of cliffCoords) {
    const cliff = new THREE.Group();
    cliff.position.set(cx, 0, cz);
    const lowerMass = new THREE.Mesh(
      new THREE.CylinderGeometry(cw * 0.45, cw * 0.62, ch * 0.65, 7),
      mats.desertTerrain
    );
    lowerMass.position.y = ch * 0.325;
    const upperMesa = new THREE.Mesh(
      new THREE.CylinderGeometry(cw * 0.3, cw * 0.44, ch * 0.45, 7),
      mats.sandstoneTrim
    );
    upperMesa.position.y = ch * 0.82;
    cliff.add(lowerMass, upperMesa);
    scene.add(cliff);
  }

  return { wallColliders, raycastWallMeshes };
}
