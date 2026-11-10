export type WeaponId = 'ak47' | 'usp' | 'awp' | 'he_grenade';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type RoundOutcome = 'ongoing' | 'victory_eliminated' | 'victory_defused' | 'defeat_kia' | 'defeat_detonated';

export type CoverMaterialType = 'wood_crate' | 'concrete_barrier' | 'explosive_barrel' | 'ballistic_glass';

export type CoverIntactState = 'intact' | 'cracked' | 'breached' | 'destroyed';

export type EnemyArchetype = 'breacher' | 'marksman' | 'heavy_shield' | 'saboteur';

export interface WeaponSpec {
  id: WeaponId;
  slot: 1 | 2 | 3 | 4;
  name: string;
  shortCode: string;
  roleClue: string;
  damage: number;
  headshotMultiplier: number;
  armorPenetration: number; // 0..1
  structureDamageMultiplier: number;
  fireInterval: number; // seconds between shots
  magSize: number;
  maxReserve: number;
  reloadTime: number;
  recoilPitchKick: number;
  recoilYawSpread: number;
  baseSpread: number;
  moveSpreadPenalty: number;
  isAutomatic: boolean;
  isScopedCapable: boolean;
  isExplosiveThrowable: boolean;
  killReward: number;
}

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  ak47: {
    id: 'ak47',
    slot: 1,
    name: 'AK-47M Kalash',
    shortCode: 'AK-47M',
    roleClue: 'Heavy Assault Rifle · High Stopping Power',
    damage: 38,
    headshotMultiplier: 3.1,
    armorPenetration: 0.78,
    structureDamageMultiplier: 1.35,
    fireInterval: 0.1,
    magSize: 30,
    maxReserve: 90,
    reloadTime: 1.9,
    recoilPitchKick: 0.032,
    recoilYawSpread: 0.014,
    baseSpread: 0.006,
    moveSpreadPenalty: 0.032,
    isAutomatic: true,
    isScopedCapable: false,
    isExplosiveThrowable: false,
    killReward: 300,
  },
  usp: {
    id: 'usp',
    slot: 2,
    name: 'USP-S Tactical .45',
    shortCode: 'USP-S',
    roleClue: 'Suppressed Sidearm · Precision Tap-Fire',
    damage: 32,
    headshotMultiplier: 3.0,
    armorPenetration: 0.55,
    structureDamageMultiplier: 0.85,
    fireInterval: 0.16,
    magSize: 12,
    maxReserve: 48,
    reloadTime: 1.4,
    recoilPitchKick: 0.018,
    recoilYawSpread: 0.006,
    baseSpread: 0.003,
    moveSpreadPenalty: 0.014,
    isAutomatic: false,
    isScopedCapable: false,
    isExplosiveThrowable: false,
    killReward: 300,
  },
  awp: {
    id: 'awp',
    slot: 3,
    name: 'AWP Magnum .338',
    shortCode: 'AWP .338',
    roleClue: 'Anti-Materiel Sniper · One-Shot Lethal & Wall Breach',
    damage: 118,
    headshotMultiplier: 3.5,
    armorPenetration: 0.96,
    structureDamageMultiplier: 3.2,
    fireInterval: 1.15,
    magSize: 5,
    maxReserve: 20,
    reloadTime: 2.4,
    recoilPitchKick: 0.085,
    recoilYawSpread: 0.008,
    baseSpread: 0.0005,
    moveSpreadPenalty: 0.055,
    isAutomatic: false,
    isScopedCapable: true,
    isExplosiveThrowable: false,
    killReward: 150,
  },
  he_grenade: {
    id: 'he_grenade',
    slot: 4,
    name: 'M67 Frag Grenade',
    shortCode: 'M67 HE',
    roleClue: 'High-Explosive Ordnance · Cover Demolition',
    damage: 145,
    headshotMultiplier: 1.0,
    armorPenetration: 0.85,
    structureDamageMultiplier: 4.5,
    fireInterval: 0.9,
    magSize: 1,
    maxReserve: 3,
    reloadTime: 0.6,
    recoilPitchKick: 0.01,
    recoilYawSpread: 0.0,
    baseSpread: 0.0,
    moveSpreadPenalty: 0.0,
    isAutomatic: false,
    isScopedCapable: false,
    isExplosiveThrowable: true,
    killReward: 300,
  },
};

export interface BuyMenuItem {
  id: 'kevlar_helmet' | 'ammo_refill' | 'he_pack' | 'combat_stim' | 'breach_charge_upgrade';
  name: string;
  cost: number;
  hotkey: string;
  description: string;
}

export const BUY_MENU_ITEMS: BuyMenuItem[] = [
  {
    id: 'kevlar_helmet',
    name: 'Heavy Kevlar + Ballistic Helmet',
    cost: 650,
    hotkey: '1',
    description: 'Restores Armor to 100 AP and reduces incoming ballistic damage by 55%.',
  },
  {
    id: 'ammo_refill',
    name: 'Full Magazine & Reserve Ordnance',
    cost: 300,
    hotkey: '2',
    description: 'Refills AK-47M, USP-S, and AWP .338 magazines to maximum capacity.',
  },
  {
    id: 'he_pack',
    name: 'M67 Frag Demolition Pack (+2 HE)',
    cost: 400,
    hotkey: '3',
    description: 'Adds 2 High-Explosive Fragmentation Grenades for cover destruction.',
  },
  {
    id: 'combat_stim',
    name: 'Tactical Trauma Medkit (+50 HP)',
    cost: 500,
    hotkey: '4',
    description: 'Emergency combat coagulant restoring up to 100 Health Points.',
  },
];

export interface DestructibleCoverState {
  id: string;
  type: CoverMaterialType;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  hp: number;
  maxHp: number;
  state: CoverIntactState;
  explosiveTriggered?: boolean;
}

export interface CoverDamageResult {
  updated: DestructibleCoverState;
  stateChanged: boolean;
  justDestroyed: boolean;
  triggeredExplosion: boolean;
  spawnedDebrisCount: number;
  scoreAwarded: number;
}

export function getCoverStateFromHpRatio(ratio: number): CoverIntactState {
  if (ratio <= 0) return 'destroyed';
  if (ratio <= 0.38) return 'breached';
  if (ratio <= 0.75) return 'cracked';
  return 'intact';
}

export function applyDamageToCover(
  cover: DestructibleCoverState,
  rawDamage: number,
  isExplosive: boolean
): CoverDamageResult {
  if (cover.state === 'destroyed') {
    return {
      updated: cover,
      stateChanged: false,
      justDestroyed: false,
      triggeredExplosion: false,
      spawnedDebrisCount: 0,
      scoreAwarded: 0,
    };
  }

  let materialMultiplier = 1.0;
  if (cover.type === 'concrete_barrier') {
    materialMultiplier = isExplosive ? 1.85 : 0.65;
  } else if (cover.type === 'wood_crate') {
    materialMultiplier = isExplosive ? 2.4 : 1.15;
  } else if (cover.type === 'explosive_barrel') {
    materialMultiplier = 1.5;
  } else if (cover.type === 'ballistic_glass') {
    materialMultiplier = 1.75;
  }

  const effectiveDamage = Math.max(1, Math.round(rawDamage * materialMultiplier));
  const nextHp = Math.max(0, cover.hp - effectiveDamage);
  const nextRatio = nextHp / Math.max(1, cover.maxHp);
  const nextState = getCoverStateFromHpRatio(nextRatio);

  const stateChanged = nextState !== cover.state;
  const justDestroyed = nextState === 'destroyed';
  const triggeredExplosion =
    justDestroyed && cover.type === 'explosive_barrel' && !cover.explosiveTriggered;

  let spawnedDebrisCount = 4;
  if (justDestroyed) {
    spawnedDebrisCount = cover.type === 'concrete_barrier' ? 18 : 14;
  } else if (stateChanged) {
    spawnedDebrisCount = 9;
  }

  const scoreAwarded = justDestroyed
    ? cover.type === 'explosive_barrel'
      ? 150
      : 100
    : stateChanged
      ? 35
      : 10;

  return {
    updated: {
      ...cover,
      hp: nextHp,
      state: nextState,
      explosiveTriggered: cover.explosiveTriggered || triggeredExplosion,
    },
    stateChanged,
    justDestroyed,
    triggeredExplosion,
    spawnedDebrisCount,
    scoreAwarded,
  };
}

export interface DamageResult {
  healthDamage: number;
  armorDamage: number;
  isLethal: boolean;
  wasHeadshot: boolean;
}

export function calculateBallisticDamage(params: {
  baseDamage: number;
  armorPenetration: number;
  headshotMultiplier: number;
  isHeadshot: boolean;
  distance: number;
  targetHp: number;
  targetArmor: number;
  hasFrontShield?: boolean;
  hitShield?: boolean;
}): DamageResult {
  const {
    baseDamage,
    armorPenetration,
    headshotMultiplier,
    isHeadshot,
    distance,
    targetHp,
    targetArmor,
    hasFrontShield,
    hitShield,
  } = params;

  // Distance falloff (minimal within 25m, gentle falloff beyond)
  const falloff = Math.max(0.65, 1 - Math.max(0, distance - 22) * 0.006);
  let raw = baseDamage * falloff * (isHeadshot ? headshotMultiplier : 1.0);

  if (hasFrontShield && hitShield && !isHeadshot) {
    raw *= 0.35; // Ballistic shield absorbs 65% of body shots unless flanked or headshotted
  }

  let healthDamage = raw;
  let armorDamage = 0;

  if (targetArmor > 0) {
    const penetrated = raw * armorPenetration;
    const absorbedByArmor = (raw - penetrated) * 0.65;
    armorDamage = Math.min(targetArmor, Math.max(1, Math.round(absorbedByArmor)));
    healthDamage = penetrated;
  }

  const finalHealthDamage = Math.max(1, Math.round(healthDamage));
  return {
    healthDamage: finalHealthDamage,
    armorDamage,
    isLethal: finalHealthDamage >= targetHp,
    wasHeadshot: isHeadshot,
  };
}

export function calculateBlastDamage(
  originX: number,
  originZ: number,
  targetX: number,
  targetZ: number,
  maxRadius: number,
  maxDamage: number
): number {
  const dx = targetX - originX;
  const dz = targetZ - originZ;
  const dist = Math.hypot(dx, dz);
  if (dist > maxRadius) return 0;
  const normalized = 1 - dist / maxRadius;
  // Smooth quadratic falloff with strong inner core
  return Math.round(maxDamage * Math.pow(normalized, 1.35));
}

export interface AABB2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function resolveCircleAABB(
  cx: number,
  cz: number,
  radius: number,
  box: AABB2D
): { x: number; z: number; collided: boolean } {
  const closestX = Math.max(box.minX, Math.min(cx, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(cz, box.maxZ));

  const dx = cx - closestX;
  const dz = cz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    return { x: cx, z: cz, collided: false };
  }

  const dist = Math.sqrt(distSq);
  if (dist > 1e-5) {
    const overlap = radius - dist;
    return {
      x: cx + (dx / dist) * overlap,
      z: cz + (dz / dist) * overlap,
      collided: true,
    };
  }

  // Center is inside AABB: push out along shallowest axis
  const leftPen = Math.abs(cx - box.minX);
  const rightPen = Math.abs(box.maxX - cx);
  const topPen = Math.abs(cz - box.minZ);
  const bottomPen = Math.abs(box.maxZ - cz);
  const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);

  if (minPen === leftPen) return { x: box.minX - radius, z: cz, collided: true };
  if (minPen === rightPen) return { x: box.maxX + radius, z: cz, collided: true };
  if (minPen === topPen) return { x: cx, z: box.minZ - radius, collided: true };
  return { x: cx, z: box.maxZ + radius, collided: true };
}

export interface EnemyTacticalState {
  id: string;
  archetype: EnemyArchetype;
  x: number;
  z: number;
  vx: number;
  vz: number;
  rotationY: number;
  hp: number;
  maxHp: number;
  armor: number;
  speed: number;
  preferredRangeMin: number;
  preferredRangeMax: number;
  windupTimer: number; // > 0 when telegraphing attack
  windupDuration: number;
  attackCooldown: number;
  strafeDir: 1 | -1;
  strafeSwitchTimer: number;
  hitFlashTimer: number;
  koTimer: number; // > 0 when in KO topple animation
  alive: boolean;
}

export interface EnemyDecisionOutput {
  moveX: number;
  moveZ: number;
  desiredRotationY: number;
  startWindup: boolean;
  fireAttackNow: boolean;
  windupProgress: number; // 0..1 for visual telegraph
}

export function stepEnemyBehavior(params: {
  enemy: EnemyTacticalState;
  playerX: number;
  playerZ: number;
  bombX: number;
  bombZ: number;
  dt: number;
  hasLineOfSight: boolean;
  canAcquireAttackToken: boolean;
}): EnemyDecisionOutput {
  const {
    enemy,
    playerX,
    playerZ,
    bombX,
    bombZ,
    dt,
    hasLineOfSight,
    canAcquireAttackToken,
  } = params;

  const dx = playerX - enemy.x;
  const dz = playerZ - enemy.z;
  const distToPlayer = Math.max(0.001, Math.hypot(dx, dz));
  const dirX = dx / distToPlayer;
  const dirZ = dz / distToPlayer;
  const perpX = -dirZ * enemy.strafeDir;
  const perpZ = dirX * enemy.strafeDir;

  const desiredRotationY = Math.atan2(dx, dz);

  let moveX = 0;
  let moveZ = 0;

  // Distinct movement policy per archetype
  switch (enemy.archetype) {
    case 'breacher': {
      // Aggressive CQB flanker: rushes in a weaving diagonal vector to close distance rapidly
      if (distToPlayer > enemy.preferredRangeMin) {
        moveX = (dirX * 0.82 + perpX * 0.55) * enemy.speed;
        moveZ = (dirZ * 0.82 + perpZ * 0.55) * enemy.speed;
      } else {
        moveX = perpX * enemy.speed * 0.9;
        moveZ = perpZ * enemy.speed * 0.9;
      }
      break;
    }
    case 'marksman': {
      // Kiter / Sniper: backs away if player gets closer than preferredRangeMin, holds steady while winding up
      if (enemy.windupTimer > 0) {
        moveX = 0;
        moveZ = 0;
      } else if (distToPlayer < enemy.preferredRangeMin) {
        moveX = (-dirX * 0.85 + perpX * 0.35) * enemy.speed;
        moveZ = (-dirZ * 0.85 + perpZ * 0.35) * enemy.speed;
      } else if (distToPlayer > enemy.preferredRangeMax) {
        moveX = dirX * enemy.speed * 0.7;
        moveZ = dirZ * enemy.speed * 0.7;
      } else {
        moveX = perpX * enemy.speed * 0.45;
        moveZ = perpZ * enemy.speed * 0.45;
      }
      break;
    }
    case 'heavy_shield': {
      // Phalanx Frontliner: steady, unrelenting forward march keeping shield squared toward player
      if (distToPlayer > enemy.preferredRangeMin) {
        moveX = dirX * enemy.speed * 0.75;
        moveZ = dirZ * enemy.speed * 0.75;
      } else {
        moveX = perpX * enemy.speed * 0.25;
        moveZ = perpZ * enemy.speed * 0.25;
      }
      break;
    }
    case 'saboteur': {
      // Bomb-Site Orbiter: patrols around the planted C4 / site anchor while strafing tangential to player
      const bDx = bombX - enemy.x;
      const bDz = bombZ - enemy.z;
      const distToBomb = Math.max(0.001, Math.hypot(bDx, bDz));
      if (distToBomb > 14 && distToPlayer > 14) {
        moveX = (bDx / distToBomb) * enemy.speed * 0.85;
        moveZ = (bDz / distToBomb) * enemy.speed * 0.85;
      } else {
        const radialBias = distToPlayer > enemy.preferredRangeMax ? 0.45 : -0.2;
        moveX = (perpX * 0.88 + dirX * radialBias) * enemy.speed;
        moveZ = (perpZ * 0.88 + dirZ * radialBias) * enemy.speed;
      }
      break;
    }
  }

  let startWindup = false;
  let fireAttackNow = false;
  let windupProgress = 0;

  if (enemy.windupTimer > 0) {
    const nextWindup = enemy.windupTimer - dt;
    windupProgress = Math.min(
      1,
      Math.max(0, 1 - nextWindup / Math.max(0.1, enemy.windupDuration))
    );
    if (nextWindup <= 0) {
      fireAttackNow = hasLineOfSight && distToPlayer <= enemy.preferredRangeMax * 1.35;
    }
  } else if (
    enemy.attackCooldown <= 0 &&
    hasLineOfSight &&
    canAcquireAttackToken &&
    distToPlayer <= enemy.preferredRangeMax * 1.15
  ) {
    startWindup = true;
  }

  return {
    moveX,
    moveZ,
    desiredRotationY,
    startWindup,
    fireAttackNow,
    windupProgress,
  };
}

export interface PurchaseResult {
  success: boolean;
  reason?: string;
  nextCash: number;
  nextHp: number;
  nextArmor: number;
  nextGrenades: number;
  refillAllWeapons: boolean;
}

export function processBuyMenuItem(params: {
  itemId: BuyMenuItem['id'];
  cash: number;
  hp: number;
  armor: number;
  grenades: number;
}): PurchaseResult {
  const { itemId, cash, hp, armor, grenades } = params;
  const item = BUY_MENU_ITEMS.find((i) => i.id === itemId);
  if (!item) {
    return {
      success: false,
      reason: 'Unknown equipment item',
      nextCash: cash,
      nextHp: hp,
      nextArmor: armor,
      nextGrenades: grenades,
      refillAllWeapons: false,
    };
  }

  if (cash < item.cost) {
    return {
      success: false,
      reason: 'Insufficient tactical funds',
      nextCash: cash,
      nextHp: hp,
      nextArmor: armor,
      nextGrenades: grenades,
      refillAllWeapons: false,
    };
  }

  switch (itemId) {
    case 'kevlar_helmet':
      if (armor >= 100) {
        return {
          success: false,
          reason: 'Armor already at 100 AP',
          nextCash: cash,
          nextHp: hp,
          nextArmor: armor,
          nextGrenades: grenades,
          refillAllWeapons: false,
        };
      }
      return {
        success: true,
        nextCash: cash - item.cost,
        nextHp: hp,
        nextArmor: 100,
        nextGrenades: grenades,
        refillAllWeapons: false,
      };

    case 'ammo_refill':
      return {
        success: true,
        nextCash: cash - item.cost,
        nextHp: hp,
        nextArmor: armor,
        nextGrenades: grenades,
        refillAllWeapons: true,
      };

    case 'he_pack':
      if (grenades >= 4) {
        return {
          success: false,
          reason: 'Maximum HE Grenade capacity reached',
          nextCash: cash,
          nextHp: hp,
          nextArmor: armor,
          nextGrenades: grenades,
          refillAllWeapons: false,
        };
      }
      return {
        success: true,
        nextCash: cash - item.cost,
        nextHp: hp,
        nextArmor: armor,
        nextGrenades: Math.min(4, grenades + 2),
        refillAllWeapons: false,
      };

    case 'combat_stim':
      if (hp >= 100) {
        return {
          success: false,
          reason: 'Health already at 100 HP',
          nextCash: cash,
          nextHp: hp,
          nextArmor: armor,
          nextGrenades: grenades,
          refillAllWeapons: false,
        };
      }
      return {
        success: true,
        nextCash: cash - item.cost,
        nextHp: Math.min(100, hp + 50),
        nextArmor: armor,
        nextGrenades: grenades,
        refillAllWeapons: false,
      };
  }

  return {
    success: false,
    nextCash: cash,
    nextHp: hp,
    nextArmor: armor,
    nextGrenades: grenades,
    refillAllWeapons: false,
  };
}

export function evaluateRoundOutcome(params: {
  playerHp: number;
  bombTimerRemaining: number;
  bombDefused: boolean;
  aliveEnemiesCount: number;
  bombPlanted: boolean;
}): RoundOutcome {
  if (params.playerHp <= 0) return 'defeat_kia';
  if (params.bombDefused) return 'victory_defused';
  if (params.bombPlanted && params.bombTimerRemaining <= 0) return 'defeat_detonated';
  if (params.aliveEnemiesCount <= 0 && !params.bombPlanted) return 'victory_eliminated';
  if (params.aliveEnemiesCount <= 0 && params.bombPlanted && params.bombTimerRemaining > 0) {
    return 'victory_eliminated';
  }
  return 'ongoing';
}

export type TacticalStance = 'standing' | 'crouching' | 'walking' | 'airborne';

export interface MovementStepInput {
  vx: number;
  vz: number;
  wishX: number; // normalized world wish direction X
  wishZ: number; // normalized world wish direction Z
  isCrouching: boolean;
  isWalking: boolean;
  isScoped: boolean;
  isGrounded: boolean;
  dt: number;
}

export interface MovementStepOutput {
  vx: number;
  vz: number;
  stance: TacticalStance;
  eyeHeightTarget: number;
}

/**
 * Counter-Strike style tactical movement with fast counter-strafe braking,
 * crouch cover height (1.06m vs 1.65m), and air-control damping.
 */
export function computeTacticalMovement(input: MovementStepInput): MovementStepOutput {
  const { vx, vz, wishX, wishZ, isCrouching, isWalking, isScoped, isGrounded, dt } = input;

  let maxSpeed = 6.8;
  if (isCrouching) {
    maxSpeed = 3.2;
  } else if (isScoped) {
    maxSpeed = 3.6;
  } else if (isWalking) {
    maxSpeed = 4.2;
  }

  const targetVx = wishX * maxSpeed;
  const targetVz = wishZ * maxSpeed;

  // Detect counter-strafe (input opposes current velocity) for crisp CS-style stopping power
  const dot = vx * wishX + vz * wishZ;
  const isBrakingOrReversing = isGrounded && ( (wishX === 0 && wishZ === 0) || dot < -0.1 );
  const accelLambda = !isGrounded ? 4.5 : isBrakingOrReversing ? 22.0 : 14.5;
  const blend = 1 - Math.exp(-accelLambda * dt);

  const nextVx = vx + (targetVx - vx) * blend;
  const nextVz = vz + (targetVz - vz) * blend;

  const stance: TacticalStance = !isGrounded
    ? 'airborne'
    : isCrouching
      ? 'crouching'
      : isWalking
        ? 'walking'
        : 'standing';

  const eyeHeightTarget = isCrouching ? 1.06 : 1.65;

  return {
    vx: Math.abs(nextVx) < 0.005 ? 0 : nextVx,
    vz: Math.abs(nextVz) < 0.005 ? 0 : nextVz,
    stance,
    eyeHeightTarget,
  };
}

export function calculateEffectiveWeaponSpread(params: {
  spec: WeaponSpec;
  recoilSpread: number;
  moveSpeed: number;
  stance: TacticalStance;
  isScoped: boolean;
}): number {
  const { spec, recoilSpread, moveSpeed, stance, isScoped } = params;
  const base = isScoped ? 0.00018 : spec.baseSpread;

  let stanceMultiplier = 1.0;
  if (stance === 'crouching') {
    stanceMultiplier = 0.52; // 48% tighter grouping when crouched
  } else if (stance === 'airborne') {
    stanceMultiplier = 2.4; // Heavy mid-air inaccuracy
  }

  let movePenalty = 0;
  if (moveSpeed > 0.45) {
    const speedRatio = Math.min(1.5, moveSpeed / 6.8);
    const walkDiscount = stance === 'walking' || stance === 'crouching' ? 0.25 : 1.0;
    movePenalty = spec.moveSpreadPenalty * speedRatio * walkDiscount;
  }

  return (base + recoilSpread + movePenalty) * stanceMultiplier;
}

export const KILL_FEED_TTL_SEC = 3.0;
export const KILL_FEED_FADE_START_SEC = 2.1;

export type KillFeedActionType = 'kill' | 'breach' | 'defuse';

export interface KillFeedEntry {
  id: string;
  actorName: string;
  weaponId: WeaponId | 'c4_kit';
  actionLabel: string;
  victimName: string;
  rewardCash: number;
  isHeadshot: boolean;
  actionType: KillFeedActionType;
  ageSec: number;
  ttlSec: number;
  opacity: number;
}

const ARCHETYPE_CALLSIGN_PREFIX: Record<EnemyArchetype, string[]> = {
  breacher: ['KORSAR', 'VIPER', 'RAVEN', 'JACKAL'],
  marksman: ['SHAHIN', 'FALCON', 'MIRAGE', 'KESTREL'],
  heavy_shield: ['BASTION', 'TITAN', 'ANVIL', 'BULWARK'],
  saboteur: ['SCORPION', 'PHANTOM', 'VORTEX', 'COBRA'],
};

const ARCHETYPE_ROLE_TAG: Record<EnemyArchetype, string> = {
  breacher: 'BREACHER',
  marksman: 'MARKSMAN',
  heavy_shield: 'HEAVY SHIELD',
  saboteur: 'SABOTEUR',
};

export function getVictimTacticalCallsign(enemyId: string, archetype: EnemyArchetype): string {
  const numMatches = enemyId.match(/\d+/g);
  const lastNum = numMatches ? parseInt(numMatches[numMatches.length - 1], 10) : 1;
  const idx = Math.max(0, lastNum);
  const pool = ARCHETYPE_CALLSIGN_PREFIX[archetype];
  const callsign = pool[idx % pool.length];
  const unitNum = (idx % 9) + 1;
  return `${callsign}-${unitNum} [${ARCHETYPE_ROLE_TAG[archetype]}]`;
}

export function getCoverTacticalLabel(
  coverId: string,
  coverType: DestructibleCoverState['type']
): string {
  const numMatch = coverId.match(/\d+/);
  const tag = numMatch ? `#${numMatch[0]}` : '';
  switch (coverType) {
    case 'wood_crate':
      return `ORDNANCE CRATE ${tag}`.trim();
    case 'concrete_barrier':
      return `K-RAIL BARRICADE ${tag}`.trim();
    case 'explosive_barrel':
      return `HAZMAT FUEL DRUM ${tag}`.trim();
    case 'ballistic_glass':
      return `BALLISTIC PARTITION ${tag}`.trim();
    default:
      return `TACTICAL COVER ${tag}`.trim();
  }
}

export function createKillFeedEntry(params: {
  id: string;
  actorName?: string;
  weaponId: WeaponId | 'c4_kit';
  actionLabel: string;
  victimName: string;
  rewardCash: number;
  isHeadshot?: boolean;
  actionType: KillFeedActionType;
  ttlSec?: number;
}): KillFeedEntry {
  return {
    id: params.id,
    actorName: params.actorName ?? 'ALPHA-1',
    weaponId: params.weaponId,
    actionLabel: params.actionLabel,
    victimName: params.victimName,
    rewardCash: params.rewardCash,
    isHeadshot: Boolean(params.isHeadshot),
    actionType: params.actionType,
    ageSec: 0,
    ttlSec: params.ttlSec ?? KILL_FEED_TTL_SEC,
    opacity: 1,
  };
}

/**
 * Advances all active kill feed entries by dt seconds, computes smooth fade-out opacity
 * over the final 0.9s window (2.1s -> 3.0s), and removes entries older than ttlSec (3.0s).
 */
export function stepKillFeedEntries(
  entries: KillFeedEntry[],
  dt: number,
  maxEntries = 5
): KillFeedEntry[] {
  if (entries.length === 0) return entries;
  const updated: KillFeedEntry[] = [];
  const safeDt = Math.max(0, dt);

  for (let i = 0; i < entries.length && updated.length < maxEntries; i++) {
    const item = entries[i];
    const nextAge = item.ageSec + safeDt;
    if (nextAge >= item.ttlSec) {
      continue;
    }
    const fadeStart = Math.max(0, item.ttlSec - (KILL_FEED_TTL_SEC - KILL_FEED_FADE_START_SEC));
    let opacity = 1;
    if (nextAge > fadeStart) {
      const fadeDuration = Math.max(0.05, item.ttlSec - fadeStart);
      opacity = Math.max(0, Math.min(1, 1 - (nextAge - fadeStart) / fadeDuration));
    }
    updated.push({
      ...item,
      ageSec: nextAge,
      opacity,
    });
  }

  return updated;
}


