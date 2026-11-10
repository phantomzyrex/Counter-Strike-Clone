import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  applyDamageToCover,
  BUY_MENU_ITEMS,
  calculateBallisticDamage,
  calculateBlastDamage,
  calculateEffectiveWeaponSpread,
  computeTacticalMovement,
  createKillFeedEntry,
  evaluateRoundOutcome,
  getCoverTacticalLabel,
  getVictimTacticalCallsign,
  processBuyMenuItem,
  resolveCircleAABB,
  stepEnemyBehavior,
  stepKillFeedEntries,
  WEAPON_SPECS,
  type AABB2D,
  type BuyMenuItem,
  type DestructibleCoverState,
  type EnemyTacticalState,
  type GameState,
  type KillFeedActionType,
  type KillFeedEntry,
  type TacticalStance,
  type WeaponId,
} from '../game/rules';
import {
  createC4BombGroup,
  createCompoundEnvironment,
  createDestructibleProp,
  createEnemyModel,
  createTacticalMaterials,
  createViewmodelWeaponRig,
  type DestructiblePropVisual,
  type EnemyVisualModel,
} from '../game/assets3d';
import {
  BOMBSITE_A_POS,
  createInitialDestructibleCover,
  createWaveEnemies,
  PLAYER_SPAWN,
} from '../game/levelData';
import { tacticalAudio } from '../game/audio';
import type { EndOfRunSnapshot, HudTelemetryState } from './TacticalHudAndShell';

// Module-scope pre-allocated scratch math helpers (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _color = new THREE.Color();
const _raycaster = new THREE.Raycaster();
const _losRaycaster = new THREE.Raycaster();

const PARTICLE_POOL_SIZE = 160;

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  scale: number;
  life: number;
  maxLife: number;
  colorHex: number;
  gravityFactor: number;
}

interface ActiveGrenade {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuseTimer: number;
}

export interface TacticalSimulationApi {
  startNewOperation: (startWeapon: 'ak47' | 'awp', keepWaveAndScore?: boolean) => void;
  setGameState: (next: GameState) => void;
  selectWeapon: (weaponId: WeaponId) => void;
  buyEquipment: (itemId: BuyMenuItem['id']) => { ok: boolean; message: string };
  throwFragGrenade: () => void;
  snapAimAndFire: () => void;
  toggleCursorHidden: () => void;
  setMouseSensitivity: (next: number) => void;
}

interface TacticalArenaCanvasProps {
  gameState: GameState;
  buyMenuOpen: boolean;
  onHudUpdate: (hud: HudTelemetryState) => void;
  onRoundEnd: (snapshot: EndOfRunSnapshot) => void;
  onRequestPauseToggle: () => void;
  onRequestBuyToggle: () => void;
  onRequestStartFromKey: () => void;
  simApiRef: React.MutableRefObject<TacticalSimulationApi | null>;
}

export const TacticalArenaCanvas: React.FC<TacticalArenaCanvasProps> = ({
  gameState,
  buyMenuOpen,
  onHudUpdate,
  onRoundEnd,
  onRequestPauseToggle,
  onRequestBuyToggle,
  onRequestStartFromKey,
  simApiRef,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Store latest React props/callbacks in refs so WebGL scene never re-initializes
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  const buyMenuOpenRef = useRef<boolean>(buyMenuOpen);
  buyMenuOpenRef.current = buyMenuOpen;

  const callbacksRef = useRef({
    onHudUpdate,
    onRoundEnd,
    onRequestPauseToggle,
    onRequestBuyToggle,
    onRequestStartFromKey,
  });
  callbacksRef.current = {
    onHudUpdate,
    onRoundEnd,
    onRequestPauseToggle,
    onRequestBuyToggle,
    onRequestStartFromKey,
  };

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL Detection (exact GPU renderer string probe from threejs skill)
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.setAttribute('data-testid', 'tactical-webgl-canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(canvas);

    // 2. Scene, Studio RoomEnvironment Reflection & Warm/Cool Lighting Rig
    const scene = new THREE.Scene();
    const horizonHex = 0xd6c3a5;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.011);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      72,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      180
    );

    // Warm Directional Key Light + Cool Sky / Warm Sandstone Ground HemisphereLight Fill
    const sunKeyLight = new THREE.DirectionalLight(0xfff2d6, 2.2);
    sunKeyLight.position.set(26, 42, 24);
    sunKeyLight.castShadow = !isSoftwareGl;
    sunKeyLight.shadow.mapSize.width = 1024;
    sunKeyLight.shadow.mapSize.height = 1024;
    const shadowD = 32;
    sunKeyLight.shadow.camera.left = -shadowD;
    sunKeyLight.shadow.camera.right = shadowD;
    sunKeyLight.shadow.camera.top = shadowD;
    sunKeyLight.shadow.camera.bottom = -shadowD;
    sunKeyLight.shadow.camera.near = 2;
    sunKeyLight.shadow.camera.far = 95;
    sunKeyLight.shadow.bias = -0.0005;
    sunKeyLight.shadow.normalBias = 0.02;
    scene.add(sunKeyLight);

    const hemiFill = new THREE.HemisphereLight(0x87ceeb, 0xbda27a, 0.85);
    hemiFill.position.set(0, 40, 0);
    scene.add(hemiFill);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    rimLight.position.set(-24, 18, -28);
    scene.add(rimLight);

    // 3. Build Materials, Compound Environment, C4 Monument & First-Person Viewmodel Rig
    const mats = createTacticalMaterials(renderer, isSoftwareGl);
    const { wallColliders, raycastWallMeshes } = createCompoundEnvironment(
      scene,
      mats,
      isSoftwareGl
    );
    const c4Visual = createC4BombGroup(BOMBSITE_A_POS.x, BOMBSITE_A_POS.z, mats, isSoftwareGl);
    scene.add(c4Visual.group);

    const viewmodelRig = createViewmodelWeaponRig(mats, isSoftwareGl);
    camera.add(viewmodelRig.root);
    scene.add(camera);

    // 4. Zero-GC Pooled Particle Ring Buffer (InstancedMesh)
    const particleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const particleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.2,
    });
    const particleInstanced = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      PARTICLE_POOL_SIZE
    );
    particleInstanced.frustumCulled = false;
    scene.add(particleInstanced);

    const particlePool: PooledParticle[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      vrx: 0,
      vry: 0,
      scale: 0,
      life: 0,
      maxLife: 1,
      colorHex: 0xffffff,
      gravityFactor: 1,
    }));
    let particleWriteCursor = 0;

    function spawnParticles(params: {
      x: number;
      y: number;
      z: number;
      count: number;
      speed: number;
      scale: number;
      colorHex: number;
      life: number;
      gravityFactor?: number;
    }) {
      const { x, y, z, count, speed, scale, colorHex, life, gravityFactor = 1 } = params;
      for (let i = 0; i < count; i++) {
        const p = particlePool[particleWriteCursor];
        particleWriteCursor = (particleWriteCursor + 1) % PARTICLE_POOL_SIZE;
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 0.25;
        p.y = y + (Math.random() - 0.5) * 0.25;
        p.z = z + (Math.random() - 0.5) * 0.25;
        const theta = Math.random() * Math.PI * 2;
        const upward = 0.25 + Math.random() * 0.85;
        const spd = speed * (0.45 + Math.random() * 0.75);
        p.vx = Math.cos(theta) * spd;
        p.vy = upward * spd;
        p.vz = Math.sin(theta) * spd;
        p.rx = Math.random() * Math.PI;
        p.ry = Math.random() * Math.PI;
        p.rz = Math.random() * Math.PI;
        p.vrx = (Math.random() - 0.5) * 10;
        p.vry = (Math.random() - 0.5) * 10;
        p.scale = scale * (0.7 + Math.random() * 0.65);
        p.life = life * (0.75 + Math.random() * 0.4);
        p.maxLife = p.life;
        p.colorHex = colorHex;
        p.gravityFactor = gravityFactor;
      }
    }

    // 5. Mutable Simulation State
    let coversState: DestructibleCoverState[] = [];
    const coverVisuals = new Map<string, DestructiblePropVisual>();
    let enemiesState: EnemyTacticalState[] = [];
    const enemyVisuals = new Map<string, EnemyVisualModel>();
    const activeGrenades: ActiveGrenade[] = [];
    const grenadeSharedGeo = new THREE.SphereGeometry(0.11, 10, 10);

    // Raycast target array rebuilt only when props/enemies spawn or die
    let shootableObjects: THREE.Object3D[] = [];
    let losBlockerObjects: THREE.Object3D[] = [];

    function rebuildRaycastTargets() {
      shootableObjects = [...raycastWallMeshes];
      losBlockerObjects = [...raycastWallMeshes];

      coversState.forEach((c) => {
        if (c.state !== 'destroyed') {
          const vis = coverVisuals.get(c.id);
          if (vis) {
            shootableObjects.push(vis.group);
            if (c.type !== 'ballistic_glass') {
              losBlockerObjects.push(vis.group);
            }
          }
        }
      });

      enemiesState.forEach((e) => {
        if (e.alive && e.koTimer <= 0) {
          const vis = enemyVisuals.get(e.id);
          if (vis) {
            shootableObjects.push(
              vis.bodyMesh,
              vis.headMesh,
              vis.leftLeg,
              vis.rightLeg,
              vis.weaponArmGroup
            );
            if (vis.shieldMesh) shootableObjects.push(vis.shieldMesh);
          }
        }
      });
    }

    // Player & Tactical Operation State
    let playerX = PLAYER_SPAWN.x;
    let playerY = PLAYER_SPAWN.y;
    let playerZ = PLAYER_SPAWN.z;
    let playerVx = 0;
    let playerVy = 0;
    let playerVz = 0;
    let playerYaw = PLAYER_SPAWN.yaw;
    let playerPitch = 0;
    let targetYaw = PLAYER_SPAWN.yaw;
    let targetPitch = 0;
    let isGrounded = true;
    let coyoteTimer = 0;
    let jumpBufferTimer = 0;
    let walkBobDistance = 0;
    let lastFootstepDist = 0;
    let squashScaleY = 1;
    let eyeHeight = PLAYER_SPAWN.y;
    let crouchToggle = false;
    let currentStance: TacticalStance = 'standing';
    let leanAmount = 0; // -1 (left) to +1 (right)
    let isCursorHidden = true; // Toggled by Right Alt (AltRight)
    let mouseSensitivity = 1.0; // 0.4x .. 2.5x
    let lastMouseClientX: number | null = null;
    let lastMouseClientY: number | null = null;

    let hp = 100;
    let ghostHp = 100;
    let armor = 100;
    let cash = 1200;
    let score = 0;
    let bestScore = 1500;
    let wave = 1;
    let operationElapsedSec = 0;

    let activeWeapon: WeaponId = 'ak47';
    let lastWeapon: WeaponId = 'usp';
    let magAmmo: Record<WeaponId, number> = {
      ak47: WEAPON_SPECS.ak47.magSize,
      usp: WEAPON_SPECS.usp.magSize,
      awp: WEAPON_SPECS.awp.magSize,
      he_grenade: WEAPON_SPECS.he_grenade.magSize,
    };
    let reserveAmmo: Record<WeaponId, number> = {
      ak47: WEAPON_SPECS.ak47.maxReserve,
      usp: WEAPON_SPECS.usp.maxReserve,
      awp: WEAPON_SPECS.awp.maxReserve,
      he_grenade: 2,
    };

    let fireCooldown = 0;
    let reloadTimer = 0;
    let isScoped = false;
    let recoilSpread = 0;
    let viewmodelRecoilZ = 0;
    let viewmodelRecoilPitch = 0;
    let muzzleFlashTimer = 0;

    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let hitMarkerTimer = 0;
    let hitMarkerType: 'none' | 'body' | 'headshot' | 'kill' = 'none';

    let bombTimer = 55;
    let c4BeepTimer = 1.0;
    let bombDefuseProgress = 0;
    let bombDefused = false;
    let roundEndedPendingTimer = 0;
    let pendingOutcomeSnapshot: EndOfRunSnapshot | null = null;

    let killsCount = 0;
    let headshotsCount = 0;
    let shotsFired = 0;
    let shotsHit = 0;
    let coverDestroyedCount = 0;
    let killFeed: KillFeedEntry[] = [];
    let statusBanner: string | null = 'BREACH SITE ALPHA · NEUTRALIZE HOSTILES OR DEFUSE C4';
    let statusBannerTimer = 5.0;

    function pushKillFeed(params: {
      weaponId: WeaponId | 'c4_kit';
      actionLabel: string;
      victimName: string;
      rewardCash: number;
      isHeadshot?: boolean;
      actionType: KillFeedActionType;
    }) {
      const entry = createKillFeedEntry({
        id: `${Date.now()}-${Math.random()}`,
        actorName: 'ALPHA-1',
        ...params,
      });
      killFeed = [entry, ...killFeed.slice(0, 4)];
      emitHudSnapshot();
    }

    function syncCursorVisibility() {
      const shouldHideCursor =
        gameStateRef.current === 'playing' && !buyMenuOpenRef.current && isCursorHidden;
      const cursorCss = shouldHideCursor ? 'none' : 'default';
      canvas.style.cursor = cursorCss;
      document.body.style.cursor = cursorCss;
      document.body.dataset.cursor = shouldHideCursor ? 'hidden' : 'visible';
      if (!shouldHideCursor && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }

    function toggleCursorMode() {
      isCursorHidden = !isCursorHidden;
      lastMouseClientX = null;
      lastMouseClientY = null;
      syncCursorVisibility();
      statusBanner = isCursorHidden
        ? 'MAIN CURSOR HIDDEN · 360° COMBAT AIM LOCKED [Right Alt]'
        : 'MAIN CURSOR VISIBLE · FREE TACTICAL UI CURSOR [Right Alt]';
      statusBannerTimer = 3.2;
      emitHudSnapshot();
    }

    function setActiveWeaponModel(wId: WeaponId) {
      if (wId !== activeWeapon) {
        lastWeapon = activeWeapon;
      }
      activeWeapon = wId;
      reloadTimer = 0;
      if (wId !== 'awp') {
        isScoped = false;
        camera.fov = 72;
        camera.updateProjectionMatrix();
      }
      (Object.keys(viewmodelRig.weaponModels) as WeaponId[]).forEach((k) => {
        viewmodelRig.weaponModels[k].visible = k === wId && !isScoped;
      });
    }

    function populateArenaForWave(waveNum: number, startWeapon: 'ak47' | 'awp', keepScore: boolean) {
      // Clear previous cover & enemy meshes
      coverVisuals.forEach((v) => scene.remove(v.group));
      coverVisuals.clear();
      enemyVisuals.forEach((v) => scene.remove(v.group));
      enemyVisuals.clear();
      activeGrenades.forEach((g) => scene.remove(g.mesh));
      activeGrenades.length = 0;

      coversState = createInitialDestructibleCover();
      coversState.forEach((c) => {
        const vis = createDestructibleProp(c, mats, isSoftwareGl);
        coverVisuals.set(c.id, vis);
        scene.add(vis.group);
      });

      enemiesState = createWaveEnemies(waveNum);
      enemiesState.forEach((e) => {
        const vis = createEnemyModel(e.id, e.archetype, mats, isSoftwareGl);
        vis.group.position.set(e.x, 0, e.z);
        enemyVisuals.set(e.id, vis);
        scene.add(vis.group);
      });

      playerX = PLAYER_SPAWN.x;
      playerY = PLAYER_SPAWN.y;
      playerZ = PLAYER_SPAWN.z;
      playerVx = 0;
      playerVy = 0;
      playerVz = 0;
      playerYaw = PLAYER_SPAWN.yaw;
      playerPitch = 0;
      targetYaw = PLAYER_SPAWN.yaw;
      targetPitch = 0;
      isGrounded = true;
      eyeHeight = PLAYER_SPAWN.y;
      crouchToggle = false;
      currentStance = 'standing';
      leanAmount = 0;
      lastWeapon = startWeapon === 'ak47' ? 'usp' : 'ak47';

      hp = 100;
      ghostHp = 100;
      armor = 100;
      if (!keepScore) {
        score = 0;
        cash = 1200;
        wave = 1;
        killsCount = 0;
        headshotsCount = 0;
        shotsFired = 0;
        shotsHit = 0;
        coverDestroyedCount = 0;
      } else {
        wave = waveNum;
        cash = Math.min(16000, cash + 800);
      }

      operationElapsedSec = 0;
      bombTimer = 55;
      bombDefuseProgress = 0;
      bombDefused = false;
      roundEndedPendingTimer = 0;
      pendingOutcomeSnapshot = null;
      killFeed = [];

      magAmmo = {
        ak47: WEAPON_SPECS.ak47.magSize,
        usp: WEAPON_SPECS.usp.magSize,
        awp: WEAPON_SPECS.awp.magSize,
        he_grenade: 1,
      };
      reserveAmmo = {
        ak47: WEAPON_SPECS.ak47.maxReserve,
        usp: WEAPON_SPECS.usp.maxReserve,
        awp: WEAPON_SPECS.awp.maxReserve,
        he_grenade: 2,
      };

      setActiveWeaponModel(startWeapon);
      statusBanner = `WAVE ${wave} DEPLOYED · BREACH COVER & SECURE BOMBSITE A`;
      statusBannerTimer = 4.5;

      rebuildRaycastTargets();
    }

    // Initialize default arena for Title screen camera tour
    populateArenaForWave(1, 'ak47', false);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Explosion & Destructible Cover Damage Handler
    function triggerExplosionAt(ex: number, ez: number, maxRadius: number, maxDamage: number) {
      tacticalAudio.playExplosion();
      cameraTrauma = Math.min(1, cameraTrauma + 0.72);
      hitstopTimer = Math.max(hitstopTimer, 0.045);

      spawnParticles({
        x: ex,
        y: 0.9,
        z: ez,
        count: 28,
        speed: 9.5,
        scale: 1.5,
        colorHex: 0xf59e0b,
        life: 0.75,
        gravityFactor: 0.7,
      });
      spawnParticles({
        x: ex,
        y: 1.1,
        z: ez,
        count: 16,
        speed: 6.5,
        scale: 1.8,
        colorHex: 0x27272a,
        life: 0.95,
        gravityFactor: 0.35,
      });

      // Damage nearby destructible cover (including chain-reacting explosive barrels!)
      const secondaryExplosions: Array<{ x: number; z: number }> = [];
      coversState = coversState.map((c) => {
        if (c.state === 'destroyed') return c;
        const dmg = calculateBlastDamage(ex, ez, c.x, c.z, maxRadius, maxDamage * 1.35);
        if (dmg <= 0) return c;
        const res = applyDamageToCover(c, dmg, true);
        if (res.stateChanged || res.justDestroyed) {
          coverVisuals.get(c.id)?.updateDamageState(res.updated.state);
          score += res.scoreAwarded;
          bestScore = Math.max(bestScore, score);
          if (res.justDestroyed) {
            coverDestroyedCount++;
            cash += 100;
            tacticalAudio.playCoverImpact(c.type, true);
            pushKillFeed({
              weaponId: 'he_grenade',
              actionLabel: 'BREACHED',
              victimName: getCoverTacticalLabel(c.id, c.type),
              rewardCash: 100,
              isHeadshot: false,
              actionType: 'breach',
            });
          }
          spawnParticles({
            x: c.x,
            y: c.height * 0.5,
            z: c.z,
            count: res.spawnedDebrisCount,
            speed: 7.5,
            scale: 1.25,
            colorHex:
              c.type === 'wood_crate'
                ? 0x9c7444
                : c.type === 'explosive_barrel'
                  ? 0xef4444
                  : 0x8e9299,
            life: 0.85,
          });
        }
        if (res.triggeredExplosion) {
          secondaryExplosions.push({ x: c.x, z: c.z });
        }
        return res.updated;
      });

      // Damage nearby hostile operatives
      enemiesState.forEach((e) => {
        if (!e.alive || e.koTimer > 0) return;
        const blastDmg = calculateBlastDamage(ex, ez, e.x, e.z, maxRadius, maxDamage);
        if (blastDmg > 0) {
          e.hp -= blastDmg;
          e.hitFlashTimer = 0.08;
          // Knockback impulse away from blast center
          const kdx = e.x - ex;
          const kdz = e.z - ez;
          const kDist = Math.max(0.2, Math.hypot(kdx, kdz));
          e.vx += (kdx / kDist) * 7.5;
          e.vz += (kdz / kDist) * 7.5;

          if (e.hp <= 0) {
            e.hp = 0;
            e.koTimer = 0.42;
            killsCount++;
            score += 300;
            bestScore = Math.max(bestScore, score);
            cash += 300;
            hitMarkerType = 'kill';
            hitMarkerTimer = 0.25;
            tacticalAudio.playHitMarker(false, true);
            pushKillFeed({
              weaponId: 'he_grenade',
              actionLabel: 'BLAST K.O.',
              victimName: getVictimTacticalCallsign(e.id, e.archetype),
              rewardCash: 300,
              isHeadshot: false,
              actionType: 'kill',
            });
          } else {
            hitMarkerType = 'body';
            hitMarkerTimer = 0.16;
          }
        }
      });

      rebuildRaycastTargets();

      // Trigger chained barrel explosions
      secondaryExplosions.forEach((pos) => {
        triggerExplosionAt(pos.x, pos.z, 7.5, 135);
      });
    }

    function launchFragGrenade() {
      const totalGrenades = (magAmmo.he_grenade ?? 0) + (reserveAmmo.he_grenade ?? 0);
      if (totalGrenades <= 0) {
        statusBanner = 'NO HE FRAG GRENADES REMAINING · BUY MORE IN ARMORY [B]';
        statusBannerTimer = 2.5;
        return;
      }

      if (magAmmo.he_grenade > 0) {
        magAmmo.he_grenade--;
        if (magAmmo.he_grenade === 0 && reserveAmmo.he_grenade > 0) {
          magAmmo.he_grenade = 1;
          reserveAmmo.he_grenade--;
        }
      } else if (reserveAmmo.he_grenade > 0) {
        reserveAmmo.he_grenade--;
      }

      const gMesh = new THREE.Mesh(grenadeSharedGeo, mats.olivePolymer);
      camera.getWorldDirection(_vec3A);
      gMesh.position.set(
        playerX + _vec3A.x * 0.6,
        playerY - 0.1,
        playerZ + _vec3A.z * 0.6
      );
      scene.add(gMesh);

      activeGrenades.push({
        mesh: gMesh,
        x: gMesh.position.x,
        y: gMesh.position.y,
        z: gMesh.position.z,
        vx: _vec3A.x * 16.5,
        vy: Math.max(2.5, _vec3A.y * 14 + 4.2),
        vz: _vec3A.z * 16.5,
        fuseTimer: 1.05,
      });

      statusBanner = 'FRAG OUT! STAND CLEAR OF BLAST RADIUS';
      statusBannerTimer = 1.8;
    }

    // 7. Weapon Firing & Ballistic Raycast Execution
    function fireActiveWeapon() {
      if (gameStateRef.current !== 'playing' || buyMenuOpenRef.current) return;
      if (fireCooldown > 0 || reloadTimer > 0) return;

      const spec = WEAPON_SPECS[activeWeapon];
      if (spec.isExplosiveThrowable) {
        launchFragGrenade();
        fireCooldown = spec.fireInterval;
        return;
      }

      if ((magAmmo[activeWeapon] ?? 0) <= 0) {
        startReload();
        return;
      }

      magAmmo[activeWeapon]--;
      shotsFired++;
      fireCooldown = spec.fireInterval;

      // Audio & Viewmodel Recoil Kick
      tacticalAudio.playWeaponFire(activeWeapon);
      viewmodelRecoilZ = activeWeapon === 'awp' ? 0.14 : 0.065;
      viewmodelRecoilPitch = activeWeapon === 'awp' ? 0.18 : 0.075;
      muzzleFlashTimer = 0.045;
      viewmodelRig.muzzleFlash.visible = !isScoped;
      viewmodelRig.muzzleFlash.rotation.z = Math.random() * Math.PI;
      if (!isSoftwareGl) {
        viewmodelRig.muzzleLight.intensity = 3.5;
      }

      cameraTrauma = Math.min(1, cameraTrauma + (activeWeapon === 'awp' ? 0.35 : 0.14));

      // Compute stance-adjusted spread ray from camera center
      const moveSpeed = Math.hypot(playerVx, playerVz);
      const effectiveSpread = calculateEffectiveWeaponSpread({
        spec,
        recoilSpread,
        moveSpeed,
        stance: currentStance,
        isScoped,
      });

      const spreadX = (Math.random() - 0.5) * effectiveSpread;
      const spreadY = (Math.random() - 0.5) * effectiveSpread;

      _raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);
      const hits = _raycaster.intersectObjects(shootableObjects, true);

      // Apply camera recoil kick after shot
      targetPitch = Math.min(1.35, targetPitch + spec.recoilPitchKick);
      targetYaw += (Math.random() - 0.5) * spec.recoilYawSpread;
      recoilSpread = Math.min(0.065, recoilSpread + spec.recoilPitchKick * 0.55);

      if (hits.length > 0) {
        const hit = hits[0];
        const hitPoint = hit.point;

        // Check if we hit an enemy
        let obj: THREE.Object3D | null = hit.object;
        let hitEnemyId: string | undefined;
        let hitZone: 'head' | 'body' | 'shield' | undefined;
        let hitCoverId: string | undefined;

        while (obj) {
          if (obj.userData?.enemyId) {
            hitEnemyId = obj.userData.enemyId;
            hitZone = obj.userData.hitZone || 'body';
            break;
          }
          if (obj.userData?.coverId) {
            hitCoverId = obj.userData.coverId;
            break;
          }
          obj = obj.parent;
        }

        if (hitEnemyId) {
          const enemy = enemiesState.find((e) => e.id === hitEnemyId && e.alive && e.koTimer <= 0);
          if (enemy) {
            shotsHit++;
            const isHeadshot = hitZone === 'head';
            const dmgResult = calculateBallisticDamage({
              baseDamage: spec.damage,
              armorPenetration: spec.armorPenetration,
              headshotMultiplier: spec.headshotMultiplier,
              isHeadshot,
              distance: hit.distance,
              targetHp: enemy.hp,
              targetArmor: enemy.armor,
              hasFrontShield: enemy.archetype === 'heavy_shield',
              hitShield: hitZone === 'shield',
            });

            enemy.hp = Math.max(0, enemy.hp - dmgResult.healthDamage);
            enemy.armor = Math.max(0, enemy.armor - dmgResult.armorDamage);
            enemy.hitFlashTimer = 0.065;

            // Directional knockback impulse
            camera.getWorldDirection(_vec3A);
            enemy.vx += _vec3A.x * (isHeadshot ? 4.2 : 2.1);
            enemy.vz += _vec3A.z * (isHeadshot ? 4.2 : 2.1);

            spawnParticles({
              x: hitPoint.x,
              y: hitPoint.y,
              z: hitPoint.z,
              count: isHeadshot ? 14 : 6,
              speed: isHeadshot ? 6.2 : 3.8,
              scale: isHeadshot ? 0.95 : 0.7,
              colorHex: hitZone === 'shield' ? 0xfbbf24 : isHeadshot ? 0xef4444 : 0xdc2626,
              life: 0.42,
            });

            if (dmgResult.isLethal) {
              enemy.hp = 0;
              enemy.koTimer = 0.38;
              enemy.windupTimer = 0;
              killsCount++;
              if (isHeadshot) headshotsCount++;
              const reward = spec.killReward + (isHeadshot ? 150 : 0);
              cash += reward;
              score += reward;
              bestScore = Math.max(bestScore, score);
              hitMarkerType = 'kill';
              hitMarkerTimer = 0.26;
              hitstopTimer = Math.max(hitstopTimer, isHeadshot ? 0.055 : 0.035);
              tacticalAudio.playHitMarker(isHeadshot, true);
              pushKillFeed({
                weaponId: activeWeapon,
                actionLabel: isHeadshot ? 'HEADSHOT' : 'NEUTRALIZED',
                victimName: getVictimTacticalCallsign(enemy.id, enemy.archetype),
                rewardCash: reward,
                isHeadshot,
                actionType: 'kill',
              });
              rebuildRaycastTargets();
            } else {
              score += isHeadshot ? 60 : 25;
              bestScore = Math.max(bestScore, score);
              hitMarkerType = isHeadshot ? 'headshot' : 'body';
              hitMarkerTimer = 0.16;
              if (isHeadshot) {
                hitstopTimer = Math.max(hitstopTimer, 0.035);
              }
              tacticalAudio.playHitMarker(isHeadshot, false);
            }
          }
        } else if (hitCoverId) {
          // Hit a destructible cover prop!
          const targetCover = coversState.find((c) => c.id === hitCoverId);
          if (targetCover && targetCover.state !== 'destroyed') {
            const rawCoverDmg = Math.round(spec.damage * spec.structureDamageMultiplier);
            const coverRes = applyDamageToCover(targetCover, rawCoverDmg, false);
            coversState = coversState.map((c) => (c.id === hitCoverId ? coverRes.updated : c));

            coverVisuals.get(hitCoverId)?.updateDamageState(coverRes.updated.state);
            tacticalAudio.playCoverImpact(targetCover.type, coverRes.justDestroyed);

            score += coverRes.scoreAwarded;
            bestScore = Math.max(bestScore, score);
            if (coverRes.justDestroyed) {
              coverDestroyedCount++;
              cash += 100;
              hitstopTimer = Math.max(hitstopTimer, 0.04);
              pushKillFeed({
                weaponId: activeWeapon,
                actionLabel: 'BREACHED',
                victimName: getCoverTacticalLabel(targetCover.id, targetCover.type),
                rewardCash: 100,
                isHeadshot: false,
                actionType: 'breach',
              });
              rebuildRaycastTargets();
            }

            spawnParticles({
              x: hitPoint.x,
              y: hitPoint.y,
              z: hitPoint.z,
              count: coverRes.spawnedDebrisCount,
              speed: coverRes.justDestroyed ? 6.8 : 4.2,
              scale: coverRes.justDestroyed ? 1.25 : 0.8,
              colorHex:
                targetCover.type === 'wood_crate'
                  ? 0xa67c49
                  : targetCover.type === 'ballistic_glass'
                    ? 0x93c5fd
                    : targetCover.type === 'explosive_barrel'
                      ? 0xf59e0b
                      : 0x9ca3af,
              life: 0.65,
            });

            if (coverRes.triggeredExplosion) {
              triggerExplosionAt(targetCover.x, targetCover.z, 7.5, 135);
            }
          }
        } else {
          // Hit sandstone wall or floor: spawn concrete/dust sparks
          spawnParticles({
            x: hitPoint.x,
            y: hitPoint.y,
            z: hitPoint.z,
            count: 5,
            speed: 3.4,
            scale: 0.65,
            colorHex: 0xe5d3b3,
            life: 0.35,
          });
        }
      }

      if ((magAmmo[activeWeapon] ?? 0) === 0 && (reserveAmmo[activeWeapon] ?? 0) > 0) {
        startReload();
      }
    }

    function startReload() {
      const spec = WEAPON_SPECS[activeWeapon];
      if (spec.isExplosiveThrowable) return;
      if (reloadTimer > 0) return;
      if ((magAmmo[activeWeapon] ?? 0) >= spec.magSize) return;
      if ((reserveAmmo[activeWeapon] ?? 0) <= 0) return;

      isScoped = false;
      camera.fov = 72;
      camera.updateProjectionMatrix();
      viewmodelRig.weaponModels[activeWeapon].visible = true;

      reloadTimer = spec.reloadTime;
      tacticalAudio.playReload();
    }

    // Tactical Snap-Aim & Fire helper ([T] key or AIM HUD button)
    function snapAimAndFire() {
      if (gameStateRef.current !== 'playing') return;

      // Ensure we have a ranged firearm ready if holding empty grenade
      if (activeWeapon === 'he_grenade' || (magAmmo[activeWeapon] ?? 0) <= 0) {
        if ((magAmmo.ak47 ?? 0) > 0) setActiveWeaponModel('ak47');
        else if ((magAmmo.usp ?? 0) > 0) setActiveWeaponModel('usp');
      }

      // Find nearest alive hostile or intact cover in front
      let bestTargetPos: THREE.Vector3 | null = null;
      let bestDist = Infinity;

      enemiesState.forEach((e) => {
        if (!e.alive || e.koTimer > 0) return;
        const d = Math.hypot(e.x - playerX, e.z - playerZ);
        if (d < bestDist) {
          bestDist = d;
          // Aim directly at head height (1.68m) for crisp Counter-Strike precision!
          bestTargetPos = new THREE.Vector3(e.x, 1.68, e.z);
        }
      });

      if (!bestTargetPos) {
        coversState.forEach((c) => {
          if (c.state === 'destroyed') return;
          const d = Math.hypot(c.x - playerX, c.z - playerZ);
          if (d < bestDist) {
            bestDist = d;
            bestTargetPos = new THREE.Vector3(c.x, c.height * 0.55, c.z);
          }
        });
      }

      if (bestTargetPos) {
        const target = bestTargetPos as THREE.Vector3;
        const dx = target.x - playerX;
        const dy = target.y - playerY;
        const dz = target.z - playerZ;
        const horizDist = Math.max(0.001, Math.hypot(dx, dz));
        // In Three.js right-handed coords where -Z is forward (yaw = 0):
        const snapYaw = Math.atan2(-dx, -dz);
        const snapPitch = Math.atan2(dy, horizDist);

        playerYaw = snapYaw;
        targetYaw = snapYaw;
        playerPitch = snapPitch;
        targetPitch = snapPitch;
        recoilSpread = 0;

        _euler.set(playerPitch, playerYaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(_euler);
        camera.position.set(playerX, playerY, playerZ);
        camera.updateMatrixWorld(true);
      }

      fireCooldown = 0;
      reloadTimer = 0;
      fireActiveWeapon();
    }

    // Expose simulation API to parent React component
    simApiRef.current = {
      startNewOperation: (startWeapon, keepWaveAndScore = false) => {
        isCursorHidden = true;
        populateArenaForWave(keepWaveAndScore ? wave + 1 : 1, startWeapon, keepWaveAndScore);
        syncCursorVisibility();
      },
      setGameState: (next) => {
        if (next === 'playing') {
          isCursorHidden = true;
        } else {
          keysHeld.clear();
          mouseDown = false;
        }
        lastMouseClientX = null;
        lastMouseClientY = null;
        syncCursorVisibility();
      },
      selectWeapon: (wId) => {
        setActiveWeaponModel(wId);
      },
      buyEquipment: (itemId) => {
        const res = processBuyMenuItem({
          itemId,
          cash,
          hp,
          armor,
          grenades: (magAmmo.he_grenade ?? 0) + (reserveAmmo.he_grenade ?? 0),
        });
        if (!res.success) {
          return { ok: false, message: res.reason || 'Purchase declined' };
        }
        cash = res.nextCash;
        hp = res.nextHp;
        ghostHp = Math.max(ghostHp, hp);
        armor = res.nextArmor;
        if (res.refillAllWeapons) {
          magAmmo.ak47 = WEAPON_SPECS.ak47.magSize;
          reserveAmmo.ak47 = WEAPON_SPECS.ak47.maxReserve;
          magAmmo.usp = WEAPON_SPECS.usp.magSize;
          reserveAmmo.usp = WEAPON_SPECS.usp.maxReserve;
          magAmmo.awp = WEAPON_SPECS.awp.magSize;
          reserveAmmo.awp = WEAPON_SPECS.awp.maxReserve;
        }
        if (itemId === 'he_pack') {
          magAmmo.he_grenade = 1;
          reserveAmmo.he_grenade = Math.max(0, res.nextGrenades - 1);
        }
        tacticalAudio.playReload();
        return { ok: true, message: 'Equipment requisitioned and equipped.' };
      },
      throwFragGrenade: () => {
        launchFragGrenade();
      },
      snapAimAndFire: () => {
        snapAimAndFire();
      },
      toggleCursorHidden: () => {
        toggleCursorMode();
      },
      setMouseSensitivity: (next) => {
        mouseSensitivity = Math.max(0.4, Math.min(2.5, next));
        statusBanner = `MOUSE AIM SENSITIVITY: ${mouseSensitivity.toFixed(2)}x`;
        statusBannerTimer = 2.2;
        emitHudSnapshot();
      },
    };

    // 8. Unified Input Hub (Held vs Edge-Triggered justPressed + Right-Alt Cursor Toggle)
    const keysHeld = new Set<string>();
    let mouseDown = false;
    const weaponCycleOrder: WeaponId[] = ['ak47', 'usp', 'awp', 'he_grenade'];

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const isRightAlt =
        code === 'AltRight' ||
        e.key === 'AltGraph' ||
        (e.key === 'Alt' && e.location === 2);

      // Right Alt toggles main cursor visibility and 360° aim mode at any time during operation
      if (isRightAlt) {
        e.preventDefault();
        if (!keysHeld.has('AltRight')) {
          keysHeld.add('AltRight');
          toggleCursorMode();
        }
        return;
      }

      const isRepeat = keysHeld.has(code);
      keysHeld.add(code);

      if (gameStateRef.current === 'title' || gameStateRef.current === 'gameover') {
        if (!isRepeat && (code === 'Enter' || code === 'Space')) {
          e.preventDefault();
          callbacksRef.current.onRequestStartFromKey();
        }
        return;
      }

      if (!isRepeat && (code === 'Escape' || code === 'KeyP')) {
        e.preventDefault();
        callbacksRef.current.onRequestPauseToggle();
        return;
      }

      if (gameStateRef.current !== 'playing') return;

      if (!isRepeat && code === 'KeyB') {
        e.preventDefault();
        callbacksRef.current.onRequestBuyToggle();
        return;
      }

      if (buyMenuOpenRef.current && !isRepeat) {
        const item = BUY_MENU_ITEMS.find((i) => `Digit${i.hotkey}` === code);
        if (item) {
          simApiRef.current?.buyEquipment(item.id);
        }
        return;
      }

      if (!isRepeat) {
        if (code === 'Digit1') setActiveWeaponModel('ak47');
        else if (code === 'Digit2') setActiveWeaponModel('usp');
        else if (code === 'Digit3') setActiveWeaponModel('awp');
        else if (code === 'Digit4') setActiveWeaponModel('he_grenade');
        else if (code === 'KeyQ') setActiveWeaponModel(lastWeapon);
        else if (code === 'KeyC') {
          crouchToggle = !crouchToggle;
        } else if (code === 'BracketLeft') {
          mouseSensitivity = Math.max(0.4, Math.round((mouseSensitivity - 0.15) * 100) / 100);
          statusBanner = `AIM SENSITIVITY: ${mouseSensitivity.toFixed(2)}x`;
          statusBannerTimer = 2.0;
        } else if (code === 'BracketRight') {
          mouseSensitivity = Math.min(2.5, Math.round((mouseSensitivity + 0.15) * 100) / 100);
          statusBanner = `AIM SENSITIVITY: ${mouseSensitivity.toFixed(2)}x`;
          statusBannerTimer = 2.0;
        } else if (code === 'KeyR') startReload();
        else if (code === 'KeyG') launchFragGrenade();
        else if (code === 'KeyT') snapAimAndFire();
        else if (code === 'KeyF') fireActiveWeapon();
        else if (code === 'Space') {
          crouchToggle = false;
          jumpBufferTimer = 0.12;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'AltRight' || e.key === 'AltGraph' || (e.key === 'Alt' && e.location === 2)) {
        keysHeld.delete('AltRight');
      }
      keysHeld.delete(e.code);
      if (e.code === 'Space' && playerVy > 0) {
        playerVy *= 0.45; // Variable jump cut
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (gameStateRef.current !== 'playing' || buyMenuOpenRef.current) return;

      // When cursor is visible (Right Alt toggled to UI cursor mode), only rotate camera if dragging with LMB
      if (!isCursorHidden && !mouseDown) {
        lastMouseClientX = e.clientX;
        lastMouseClientY = e.clientY;
        return;
      }

      const baseSens = (isScoped ? 0.0011 : 0.0028) * mouseSensitivity;
      let dx = e.movementX;
      let dy = e.movementY;

      if (document.pointerLockElement !== canvas) {
        if (lastMouseClientX !== null && lastMouseClientY !== null) {
          const fallbackDx = e.clientX - lastMouseClientX;
          const fallbackDy = e.clientY - lastMouseClientY;
          if (Math.abs(dx) === 0 && Math.abs(dy) === 0) {
            dx = fallbackDx;
            dy = fallbackDy;
          }
        }
        lastMouseClientX = e.clientX;
        lastMouseClientY = e.clientY;
      }

      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        targetYaw -= dx * baseSens;
        targetPitch = Math.max(-1.35, Math.min(1.35, targetPitch - dy * baseSens));
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (gameStateRef.current !== 'playing' || buyMenuOpenRef.current) return;
      lastMouseClientX = e.clientX;
      lastMouseClientY = e.clientY;

      // If in Combat Aim mode (isCursorHidden === true), try acquiring PointerLock when user clicks canvas
      if (isCursorHidden && document.pointerLockElement !== canvas) {
        try {
          canvas.requestPointerLock?.();
        } catch {
          // Ignore pointerLock errors in sandboxed iframes
        }
      }

      if (e.button === 2) {
        // Right-click optic zoom on AWP
        if (WEAPON_SPECS[activeWeapon].isScopedCapable) {
          isScoped = !isScoped;
          camera.fov = isScoped ? 24 : 72;
          camera.updateProjectionMatrix();
          viewmodelRig.weaponModels[activeWeapon].visible = !isScoped;
        }
        return;
      }
      if (e.button === 0) {
        mouseDown = true;
        fireActiveWeapon();
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseDown = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (gameStateRef.current !== 'playing' || buyMenuOpenRef.current) return;
      e.preventDefault();
      const idx = weaponCycleOrder.indexOf(activeWeapon);
      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIdx = (idx + dir + weaponCycleOrder.length) % weaponCycleOrder.length;
      setActiveWeaponModel(weaponCycleOrder[nextIdx]);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const clearInputsOnBlur = () => {
      keysHeld.clear();
      mouseDown = false;
      lastMouseClientX = null;
      lastMouseClientY = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', clearInputsOnBlur);
    document.addEventListener('visibilitychange', clearInputsOnBlur);

    syncCursorVisibility();

    // 9. Simulation & Render Loop with Software-WebGL Pacing (`afterDraw`)
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    let hudSyncAccumulator = 0;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function emitHudSnapshot() {
      const spec = WEAPON_SPECS[activeWeapon];
      const moveSpeed = Math.hypot(playerVx, playerVz);
      const effSpread = calculateEffectiveWeaponSpread({
        spec,
        recoilSpread,
        moveSpeed,
        stance: currentStance,
        isScoped,
      });
      const spreadPx = Math.min(42, effSpread * 520);
      const distToBomb = Math.hypot(playerX - BOMBSITE_A_POS.x, playerZ - BOMBSITE_A_POS.z);

      callbacksRef.current.onHudUpdate({
        hp,
        ghostHp,
        armor,
        cash,
        score,
        bestScore,
        wave,
        activeWeapon,
        magAmmo: { ...magAmmo },
        reserveAmmo: { ...reserveAmmo },
        isReloading: reloadTimer > 0,
        reloadProgress:
          reloadTimer > 0 ? Math.max(0, 1 - reloadTimer / Math.max(0.1, spec.reloadTime)) : 0,
        isScoped,
        crosshairSpreadPx: isScoped ? 2 : spreadPx,
        hitMarkerType: hitMarkerTimer > 0 ? hitMarkerType : 'none',
        bombTimer,
        bombDefuseProgress,
        canDefuseNow: distToBomb <= 4.2 && !bombDefused,
        enemiesAlive: enemiesState.filter((e) => e.alive && e.koTimer <= 0).length,
        enemiesTotal: enemiesState.length,
        killsCount,
        headshotsCount,
        shotsFired,
        shotsHit,
        coverDestroyedCount,
        totalCoverCount: coversState.length,
        playerX,
        playerZ,
        playerYaw,
        radarEnemies: enemiesState.map((e) => ({
          x: e.x,
          z: e.z,
          alive: e.alive && e.koTimer <= 0,
          windup: e.windupTimer > 0,
        })),
        radarCovers: coversState.map((c) => ({
          x: c.x,
          z: c.z,
          state: c.state,
        })),
        killFeed,
        statusBanner: statusBannerTimer > 0 ? statusBanner : null,
        stance: currentStance,
        isCursorHidden,
        mouseSensitivity,
      });
    }

    // Emit initial HUD snapshot immediately
    emitHudSnapshot();

    function tick() {
      if (disposed) return;

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05); // Clamped dt <= 0.05s for physics stability
      const uiDt = Math.min(rawDt, 0.35); // Wall-clock delta for 3-second UI timers
      const elapsed = clock.getElapsedTime();

      const currentState = gameStateRef.current;

      // A. TITLE SCREEN LIVE CAMERA FLYOVER TOUR
      if (currentState === 'title') {
        viewmodelRig.root.visible = false;
        const orbitAngle = elapsed * 0.25 + 0.35;
        const camX = Math.sin(orbitAngle) * 9.5;
        const camZ = 4.5 + Math.cos(orbitAngle) * 7.5;
        camera.position.set(camX, 4.2 + Math.sin(elapsed * 0.5) * 0.4, camZ);
        camera.lookAt(0, 1.4, -10.5);

        // Gently animate C4 beacon and idling operatives during title tour
        const pulse = (Math.sin(elapsed * 6) + 1) * 0.5;
        (c4Visual.beaconMesh.material as THREE.MeshBasicMaterial).color.setHex(
          pulse > 0.5 ? 0xef4444 : 0x450a0a
        );
      }

      // B. ACTIVE GAMEPLAY SIMULATION
      else if (currentState === 'playing') {
        viewmodelRig.root.visible = true;

        // Tick real-time timers (hitstop, trauma, muzzle flash, hitmarkers, 3s killfeed)
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        }
        cameraTrauma = Math.max(0, cameraTrauma - dt * 1.85);
        recoilSpread = Math.max(0, recoilSpread - dt * 0.14);
        hitMarkerTimer = Math.max(0, hitMarkerTimer - dt);
        statusBannerTimer = Math.max(0, statusBannerTimer - uiDt);
        ghostHp = THREE.MathUtils.damp(ghostHp, hp, 3.2, dt);
        let killFeedChanged = false;
        if (killFeed.length > 0) {
          const prevLen = killFeed.length;
          killFeed = stepKillFeedEntries(killFeed, uiDt, 5);
          killFeedChanged = killFeed.length !== prevLen || killFeed.some((k) => k.opacity < 1);
        }

        if (muzzleFlashTimer > 0) {
          muzzleFlashTimer -= dt;
          if (muzzleFlashTimer <= 0) {
            viewmodelRig.muzzleFlash.visible = false;
            viewmodelRig.muzzleLight.intensity = 0;
          }
        }

        const simDt = hitstopTimer > 0 ? 0 : dt;

        if (simDt > 0) {
          operationElapsedSec += simDt;

          // 1. Weapon Cooldown, Reloading & Automatic Fire
          if (fireCooldown > 0) {
            fireCooldown = Math.max(0, fireCooldown - simDt);
          }

          if (reloadTimer > 0) {
            reloadTimer -= simDt;
            if (reloadTimer <= 0) {
              reloadTimer = 0;
              const spec = WEAPON_SPECS[activeWeapon];
              const needed = spec.magSize - (magAmmo[activeWeapon] ?? 0);
              const available = Math.min(needed, reserveAmmo[activeWeapon] ?? 0);
              magAmmo[activeWeapon] = (magAmmo[activeWeapon] ?? 0) + available;
              reserveAmmo[activeWeapon] = (reserveAmmo[activeWeapon] ?? 0) - available;
            }
          }

          if (
            mouseDown &&
            !buyMenuOpenRef.current &&
            WEAPON_SPECS[activeWeapon].isAutomatic &&
            fireCooldown <= 0 &&
            reloadTimer <= 0
          ) {
            fireActiveWeapon();
          }
          if (
            (keysHeld.has('KeyF') || keysHeld.has('Enter')) &&
            !buyMenuOpenRef.current &&
            fireCooldown <= 0 &&
            reloadTimer <= 0
          ) {
            fireActiveWeapon();
          }

          // 2. Keyboard Look & Smooth Exponential Camera Damping
          const turnSpeed = 2.05 * mouseSensitivity;
          if (keysHeld.has('ArrowLeft')) {
            targetYaw += turnSpeed * simDt;
          }
          if (keysHeld.has('ArrowRight')) {
            targetYaw -= turnSpeed * simDt;
          }
          if (keysHeld.has('ArrowUp')) {
            targetPitch = Math.min(1.25, targetPitch + turnSpeed * 0.7 * simDt);
          }
          if (keysHeld.has('ArrowDown')) {
            targetPitch = Math.max(-1.25, targetPitch - turnSpeed * 0.7 * simDt);
          }

          playerYaw = THREE.MathUtils.damp(playerYaw, targetYaw, 24, simDt);
          playerPitch = THREE.MathUtils.damp(playerPitch, targetPitch, 24, simDt);

          // Tactical Corner Lean (KeyZ = Left Peek, KeyX = Right Peek)
          const desiredLean =
            (keysHeld.has('KeyX') ? 1 : 0) - (keysHeld.has('KeyZ') ? 1 : 0);
          leanAmount = THREE.MathUtils.damp(leanAmount, desiredLean, 14, simDt);

          // 3. Player Movement, Counter-Strafing, Crouch, Silent Walk & Collision Resolution
          syncCursorVisibility();

          const forwardInput =
            (keysHeld.has('KeyW') ? 1 : 0) - (keysHeld.has('KeyS') ? 1 : 0);
          const strafeInput =
            (keysHeld.has('KeyD') ? 1 : 0) - (keysHeld.has('KeyA') ? 1 : 0);

          const forwardX = -Math.sin(playerYaw);
          const forwardZ = -Math.cos(playerYaw);
          const rightX = Math.cos(playerYaw);
          const rightZ = -Math.sin(playerYaw);

          let wishX = forwardX * forwardInput + rightX * strafeInput;
          let wishZ = forwardZ * forwardInput + rightZ * strafeInput;
          const wishLen = Math.hypot(wishX, wishZ);
          if (wishLen > 1) {
            wishX /= wishLen;
            wishZ /= wishLen;
          }

          const isCrouching =
            crouchToggle || keysHeld.has('ControlLeft') || keysHeld.has('ControlRight');
          const isWalking =
            keysHeld.has('ShiftLeft') || keysHeld.has('ShiftRight');
          const footstepSilent = isCrouching || isWalking;

          const moveKinematics = computeTacticalMovement({
            vx: playerVx,
            vz: playerVz,
            wishX,
            wishZ,
            isGrounded,
            isCrouching,
            isWalking,
            isScoped,
            dt: simDt,
          });

          playerVx = moveKinematics.vx;
          playerVz = moveKinematics.vz;
          currentStance = moveKinematics.stance;
          eyeHeight = THREE.MathUtils.damp(
            eyeHeight,
            moveKinematics.eyeHeightTarget,
            14,
            simDt
          );

          if (isGrounded) {
            coyoteTimer = 0.1;
          } else {
            coyoteTimer = Math.max(0, coyoteTimer - simDt);
          }

          if (jumpBufferTimer > 0) {
            jumpBufferTimer = Math.max(0, jumpBufferTimer - simDt);
            if (coyoteTimer > 0) {
              playerVy = 6.6;
              isGrounded = false;
              coyoteTimer = 0;
              jumpBufferTimer = 0;
              squashScaleY = 1.14;
              tacticalAudio.playFootstep();
            }
          }

          if (!isGrounded) {
            playerVy -= 18.0 * simDt;
            playerY += playerVy * simDt;
            if (playerY <= eyeHeight) {
              playerY = eyeHeight;
              playerVy = 0;
              isGrounded = true;
              squashScaleY = 0.86;
              if (!footstepSilent) {
                tacticalAudio.playFootstep();
              }
            }
          } else {
            playerY = eyeHeight;
          }
          squashScaleY = THREE.MathUtils.damp(squashScaleY, 1.0, 12, simDt);

          let nextPx = playerX + playerVx * simDt;
          let nextPz = playerZ + playerVz * simDt;

          // Resolve against compound walls & intact/cracked/breached cover props
          const playerRadius = 0.55;
          for (const box of wallColliders) {
            const res = resolveCircleAABB(nextPx, nextPz, playerRadius, box);
            nextPx = res.x;
            nextPz = res.z;
          }
          for (const c of coversState) {
            if (c.state === 'destroyed') continue;
            const cBox: AABB2D = {
              minX: c.x - c.width * 0.5,
              maxX: c.x + c.width * 0.5,
              minZ: c.z - c.depth * 0.5,
              maxZ: c.z + c.depth * 0.5,
            };
            const res = resolveCircleAABB(nextPx, nextPz, playerRadius, cBox);
            nextPx = res.x;
            nextPz = res.z;
          }

          const stepDist = Math.hypot(nextPx - playerX, nextPz - playerZ);
          walkBobDistance += stepDist;
          if (
            isGrounded &&
            !footstepSilent &&
            walkBobDistance - lastFootstepDist > 2.4
          ) {
            lastFootstepDist = walkBobDistance;
            tacticalAudio.playFootstep();
          }

          playerX = nextPx;
          playerZ = nextPz;

          // 4. Planted C4 Countdown & Interactive Defusal ([E] near Bombsite A)
          bombTimer = Math.max(0, bombTimer - simDt);
          const beepInterval = bombTimer < 10 ? 0.24 : bombTimer < 22 ? 0.5 : 0.95;
          c4BeepTimer -= simDt;
          if (c4BeepTimer <= 0 && !bombDefused) {
            c4BeepTimer = beepInterval;
            tacticalAudio.playC4Beep(bombTimer < 12);
          }

          const c4Pulse = (Math.sin(elapsed * (bombTimer < 12 ? 18 : 8)) + 1) * 0.5;
          (c4Visual.beaconMesh.material as THREE.MeshBasicMaterial).color.setHex(
            bombDefused ? 0x10b981 : c4Pulse > 0.5 ? 0xef4444 : 0x450a0a
          );

          const distToBomb = Math.hypot(playerX - BOMBSITE_A_POS.x, playerZ - BOMBSITE_A_POS.z);
          if (distToBomb <= 4.2 && keysHeld.has('KeyE') && !bombDefused) {
            bombDefuseProgress = Math.min(1, bombDefuseProgress + simDt / 2.5);
            if (bombDefuseProgress >= 1) {
              bombDefused = true;
              score += 500;
              bestScore = Math.max(bestScore, score);
              cash += 600;
              pushKillFeed({
                weaponId: 'c4_kit',
                actionLabel: 'DEFUSED',
                victimName: 'SITE A PLANTED C4',
                rewardCash: 600,
                isHeadshot: false,
                actionType: 'defuse',
              });
            }
          } else {
            bombDefuseProgress = Math.max(0, bombDefuseProgress - simDt * 0.8);
          }

          // 5. Active Thrown HE Frag Grenades Simulation
          for (let i = activeGrenades.length - 1; i >= 0; i--) {
            const g = activeGrenades[i];
            g.vy -= 14.5 * simDt;
            g.x += g.vx * simDt;
            g.y += g.vy * simDt;
            g.z += g.vz * simDt;

            if (g.y <= 0.12) {
              g.y = 0.12;
              g.vy = -g.vy * 0.42;
              g.vx *= 0.72;
              g.vz *= 0.72;
            }

            g.mesh.position.set(g.x, g.y, g.z);
            g.mesh.rotation.x += 8 * simDt;
            g.mesh.rotation.z += 6 * simDt;

            g.fuseTimer -= simDt;
            if (g.fuseTimer <= 0) {
              scene.remove(g.mesh);
              activeGrenades.splice(i, 1);
              triggerExplosionAt(g.x, g.z, 8.5, WEAPON_SPECS.he_grenade.damage);
            }
          }

          // 6. Hostile Tactical AI (4 Distinct Policies + Attack Token Pool + Windup Telegraphs)
          let activeAttackersCount = enemiesState.filter(
            (e) => e.alive && e.koTimer <= 0 && e.windupTimer > 0
          ).length;
          const maxConcurrentAttackers = 2;

          enemiesState.forEach((enemy) => {
            const vis = enemyVisuals.get(enemy.id);
            if (!vis) return;

            if (!enemy.alive) {
              vis.group.visible = false;
              return;
            }

            // KO topple transition (0.38s fall before removal)
            if (enemy.koTimer > 0) {
              enemy.koTimer -= simDt;
              const koProgress = 1 - Math.max(0, enemy.koTimer / 0.38);
              vis.group.rotation.x = -koProgress * (Math.PI * 0.48);
              vis.group.position.y = -koProgress * 0.25;
              vis.telegraphRing.visible = false;
              vis.telegraphLaser.visible = false;
              if (enemy.koTimer <= 0) {
                enemy.alive = false;
                vis.group.visible = false;
              }
              return;
            }

            // Hit flash decay
            if (enemy.hitFlashTimer > 0) {
              enemy.hitFlashTimer -= simDt;
              vis.bodyMaterial.emissive.setHex(0xffffff);
              vis.bodyMaterial.emissiveIntensity = 0.75;
            } else {
              vis.bodyMaterial.emissive.setHex(0x000000);
              vis.bodyMaterial.emissiveIntensity = 0;
            }

            enemy.attackCooldown = Math.max(0, enemy.attackCooldown - simDt);
            enemy.strafeSwitchTimer -= simDt;
            if (enemy.strafeSwitchTimer <= 0) {
              enemy.strafeDir = enemy.strafeDir === 1 ? -1 : 1;
              enemy.strafeSwitchTimer = 1.8 + Math.random() * 1.4;
            }

            // Line-of-sight check from enemy eye to player
            _vec3A.set(enemy.x, 1.45, enemy.z);
            _vec3B.set(playerX - enemy.x, playerY - 1.45, playerZ - enemy.z);
            const distToPlayer = _vec3B.length();
            _vec3B.normalize();
            _losRaycaster.set(_vec3A, _vec3B);
            _losRaycaster.far = distToPlayer;
            const losHits = _losRaycaster.intersectObjects(losBlockerObjects, true);
            const hasLineOfSight = losHits.length === 0;

            const canAcquireToken = activeAttackersCount < maxConcurrentAttackers;
            const decision = stepEnemyBehavior({
              enemy,
              playerX,
              playerZ,
              bombX: BOMBSITE_A_POS.x,
              bombZ: BOMBSITE_A_POS.z,
              dt: simDt,
              hasLineOfSight,
              canAcquireAttackToken: canAcquireToken,
            });

            if (decision.startWindup) {
              enemy.windupTimer = enemy.windupDuration;
              activeAttackersCount++;
              tacticalAudio.playEnemyTelegraph();
            }

            if (enemy.windupTimer > 0) {
              enemy.windupTimer -= simDt;
              vis.telegraphRing.visible = true;
              vis.telegraphLaser.visible = true;
              const s = 0.75 + decision.windupProgress * 0.45;
              vis.telegraphRing.scale.set(s, s, 1);

              if (decision.fireAttackNow) {
                enemy.windupTimer = 0;
                enemy.attackCooldown =
                  enemy.archetype === 'marksman'
                    ? 2.2
                    : enemy.archetype === 'breacher'
                      ? 1.45
                      : 1.75;
                vis.telegraphRing.visible = false;
                vis.telegraphLaser.visible = false;

                // Execute Enemy Shot (with accuracy scaled by distance & player movement)
                const playerSpeed = Math.hypot(playerVx, playerVz);
                const hitProb = Math.max(
                  0.25,
                  (enemy.archetype === 'marksman' ? 0.78 : 0.62) -
                    distToPlayer * 0.01 -
                    playerSpeed * 0.03
                );

                if (Math.random() < hitProb) {
                  const baseEnemyDmg =
                    enemy.archetype === 'marksman'
                      ? 22
                      : enemy.archetype === 'breacher'
                        ? 16
                        : 14;
                  const dmgRes = calculateBallisticDamage({
                    baseDamage: baseEnemyDmg,
                    armorPenetration: 0.58,
                    headshotMultiplier: 1.5,
                    isHeadshot: false,
                    distance: distToPlayer,
                    targetHp: hp,
                    targetArmor: armor,
                  });
                  hp = Math.max(0, hp - dmgRes.healthDamage);
                  armor = Math.max(0, armor - dmgRes.armorDamage);
                  cameraTrauma = Math.min(1, cameraTrauma + 0.38);
                  tacticalAudio.playPlayerHurt();
                }
              }
            } else {
              vis.telegraphRing.visible = false;
              vis.telegraphLaser.visible = false;
            }

            // Apply enemy movement & knockback damping
            enemy.vx = THREE.MathUtils.damp(enemy.vx, decision.moveX, 10, simDt);
            enemy.vz = THREE.MathUtils.damp(enemy.vz, decision.moveZ, 10, simDt);

            let nextEx = enemy.x + enemy.vx * simDt;
            let nextEz = enemy.z + enemy.vz * simDt;
            for (const box of wallColliders) {
              const res = resolveCircleAABB(nextEx, nextEz, 0.52, box);
              nextEx = res.x;
              nextEz = res.z;
            }
            for (const c of coversState) {
              if (c.state === 'destroyed') continue;
              const cBox: AABB2D = {
                minX: c.x - c.width * 0.5,
                maxX: c.x + c.width * 0.5,
                minZ: c.z - c.depth * 0.5,
                maxZ: c.z + c.depth * 0.5,
              };
              const res = resolveCircleAABB(nextEx, nextEz, 0.52, cBox);
              nextEx = res.x;
              nextEz = res.z;
            }

            const movedDist = Math.hypot(nextEx - enemy.x, nextEz - enemy.z);
            enemy.x = nextEx;
            enemy.z = nextEz;
            enemy.rotationY = THREE.MathUtils.damp(
              enemy.rotationY,
              decision.desiredRotationY,
              12,
              simDt
            );

            vis.group.position.set(enemy.x, 0, enemy.z);
            vis.group.rotation.y = enemy.rotationY;

            // Gait-synced hip-pivoted leg walk cycle + upper-body tactical kinematics
            const moveBlend = Math.min(1, movedDist / Math.max(0.001, simDt * 2.8));
            const stridePhase = elapsed * 8.5 + enemy.x * 0.7;
            vis.leftLeg.rotation.x = Math.sin(stridePhase) * 0.46 * moveBlend;
            vis.rightLeg.rotation.x = -Math.sin(stridePhase) * 0.46 * moveBlend;

            const breatheOffset = Math.sin(elapsed * 3.2 + enemy.z) * 0.014;
            const strideBounce = Math.abs(Math.cos(stridePhase)) * 0.028 * moveBlend;
            vis.bodyMesh.position.y = 1.14 + breatheOffset + strideBounce;
            vis.headMesh.position.y = 1.66 + breatheOffset + strideBounce;

            const aimRaise = enemy.windupTimer > 0 ? -0.14 : Math.sin(stridePhase) * 0.06 * moveBlend;
            vis.weaponArmGroup.position.y = 1.24 + breatheOffset + strideBounce * 0.8;
            vis.weaponArmGroup.rotation.x = THREE.MathUtils.damp(
              vis.weaponArmGroup.rotation.x,
              aimRaise,
              12,
              simDt
            );
          });

          // 7. Update Pooled 3D Debris & Spark Particles in-place
          for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
            const p = particlePool[i];
            if (!p.active) {
              _mat4.makeScale(0, 0, 0);
              particleInstanced.setMatrixAt(i, _mat4);
              continue;
            }

            p.life -= simDt;
            if (p.life <= 0) {
              p.active = false;
              _mat4.makeScale(0, 0, 0);
              particleInstanced.setMatrixAt(i, _mat4);
              continue;
            }

            p.vy -= 16.5 * p.gravityFactor * simDt;
            p.x += p.vx * simDt;
            p.y += p.vy * simDt;
            p.z += p.vz * simDt;

            if (p.y <= 0.06) {
              p.y = 0.06;
              p.vy = -p.vy * 0.36;
              p.vx *= 0.72;
              p.vz *= 0.72;
            }

            p.rx += p.vrx * simDt;
            p.ry += p.vry * simDt;

            const lifeScale = p.scale * Math.min(1, (p.life / p.maxLife) * 1.4);
            _vec3A.set(p.x, p.y, p.z);
            _euler.set(p.rx, p.ry, p.rz);
            _quat.setFromEuler(_euler);
            _vec3B.set(lifeScale, lifeScale, lifeScale);
            _mat4.compose(_vec3A, _quat, _vec3B);
            particleInstanced.setMatrixAt(i, _mat4);
            _color.setHex(p.colorHex);
            particleInstanced.setColorAt(i, _color);
          }
          particleInstanced.instanceMatrix.needsUpdate = true;
          if (particleInstanced.instanceColor) {
            particleInstanced.instanceColor.needsUpdate = true;
          }

          // 8. Evaluate Round Victory / Defeat Conditions
          const aliveCount = enemiesState.filter((e) => e.alive && e.koTimer <= 0).length;
          const outcome = evaluateRoundOutcome({
            playerHp: hp,
            bombTimerRemaining: bombTimer,
            bombDefused,
            aliveEnemiesCount: aliveCount,
            bombPlanted: true,
          });

          if (outcome !== 'ongoing' && !pendingOutcomeSnapshot) {
            const isWin = outcome.startsWith('victory');
            tacticalAudio.playRoundEndSting(isWin);
            if (outcome === 'defeat_detonated') {
              triggerExplosionAt(BOMBSITE_A_POS.x, BOMBSITE_A_POS.z, 18, 200);
            }
            pendingOutcomeSnapshot = {
              outcome,
              score,
              bestScore: Math.max(bestScore, score),
              wave,
              clearTimeSec: operationElapsedSec,
              killsCount,
              headshotsCount,
              coverDestroyedCount,
              accuracyPercent:
                shotsFired > 0 ? Math.min(100, (shotsHit / shotsFired) * 100) : 100,
              bombTimeRemaining: bombTimer,
              enemiesRemaining: aliveCount,
            };
            roundEndedPendingTimer = 0.55; // Brief 0.55s final beat before modal
          }

          if (pendingOutcomeSnapshot) {
            roundEndedPendingTimer -= simDt;
            if (roundEndedPendingTimer <= 0) {
              const snap = pendingOutcomeSnapshot;
              pendingOutcomeSnapshot = null;
              callbacksRef.current.onRoundEnd(snap);
            }
          }
        }

        // 9. Update First-Person Camera & Weapon Viewmodel Kinematics (with Tactical Lean)
        const shakeMag = cameraTrauma * cameraTrauma;
        const shakePitch = (Math.random() - 0.5) * 0.06 * shakeMag;
        const shakeYaw = (Math.random() - 0.5) * 0.06 * shakeMag;
        const shakeRoll = (Math.random() - 0.5) * 0.08 * shakeMag;

        const moveSpeed = Math.hypot(playerVx, playerVz);
        const bobOffset =
          isGrounded && moveSpeed > 0.3
            ? Math.sin(walkBobDistance * 2.6) *
              (currentStance === 'crouching' ? 0.018 : 0.038) *
              Math.min(1, moveSpeed / 6)
            : 0;

        // Horizontal camera offset & roll for Corner Leaning (Z/X)
        const rightX = Math.cos(playerYaw);
        const rightZ = -Math.sin(playerYaw);
        const leanOffsetX = rightX * leanAmount * 0.38;
        const leanOffsetZ = rightZ * leanAmount * 0.38;
        const leanRoll = -leanAmount * 0.11;

        camera.position.set(
          playerX + leanOffsetX,
          playerY * squashScaleY + bobOffset,
          playerZ + leanOffsetZ
        );
        _euler.set(playerPitch + shakePitch, playerYaw + shakeYaw, shakeRoll + leanRoll, 'YXZ');
        camera.quaternion.setFromEuler(_euler);

        // Smooth viewmodel recoil & reload animation
        viewmodelRecoilZ = THREE.MathUtils.damp(viewmodelRecoilZ, 0, 18, dt);
        viewmodelRecoilPitch = THREE.MathUtils.damp(viewmodelRecoilPitch, 0, 18, dt);

        const reloadDip =
          reloadTimer > 0 ? Math.sin((reloadTimer / WEAPON_SPECS[activeWeapon].reloadTime) * Math.PI) * -0.18 : 0;
        const swayX = Math.cos(walkBobDistance * 1.3) * 0.012 * Math.min(1, moveSpeed / 6);
        const swayY = Math.abs(Math.sin(walkBobDistance * 2.6)) * -0.014 * Math.min(1, moveSpeed / 6);

        viewmodelRig.root.position.set(
          0.21 + swayX,
          -0.18 + swayY + reloadDip,
          -0.44 + viewmodelRecoilZ
        );
        viewmodelRig.root.rotation.set(
          viewmodelRecoilPitch + reloadDip * 1.5,
          0,
          reloadTimer > 0 ? -0.35 : leanRoll * 0.45
        );

        // Throttle React HUD state updates to ~12Hz so React reconciliation never slows 60fps loop
        hudSyncAccumulator += uiDt;
        if (hudSyncAccumulator >= 0.08 || killFeedChanged) {
          hudSyncAccumulator = 0;
          emitHudSnapshot();
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', clearInputsOnBlur);
      document.removeEventListener('visibilitychange', clearInputsOnBlur);
      document.body.style.cursor = 'default';
      particleGeo.dispose();
      particleMat.dispose();
      grenadeSharedGeo.dispose();
      mats.dispose();
      renderer.dispose();
    };
  }, [simApiRef]);

  return (
    <div
      ref={canvasMountRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-stone-950"
    />
  );
};
