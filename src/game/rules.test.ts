import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDamageToCover,
  calculateBallisticDamage,
  calculateBlastDamage,
  evaluateRoundOutcome,
  processBuyMenuItem,
  resolveCircleAABB,
  stepEnemyBehavior,
  WEAPON_SPECS,
  type DestructibleCoverState,
  type EnemyTacticalState,
} from './rules';

test('ballistic damage applies headshot multiplier and armor absorption accurately', () => {
  const bodyHitUnarmored = calculateBallisticDamage({
    baseDamage: WEAPON_SPECS.ak47.damage,
    armorPenetration: WEAPON_SPECS.ak47.armorPenetration,
    headshotMultiplier: WEAPON_SPECS.ak47.headshotMultiplier,
    isHeadshot: false,
    distance: 10,
    targetHp: 100,
    targetArmor: 0,
  });
  assert.equal(bodyHitUnarmored.healthDamage, 38);
  assert.equal(bodyHitUnarmored.isLethal, false);

  const headshotArmored = calculateBallisticDamage({
    baseDamage: WEAPON_SPECS.ak47.damage,
    armorPenetration: WEAPON_SPECS.ak47.armorPenetration,
    headshotMultiplier: WEAPON_SPECS.ak47.headshotMultiplier,
    isHeadshot: true,
    distance: 12,
    targetHp: 90,
    targetArmor: 50,
  });
  assert.equal(headshotArmored.wasHeadshot, true);
  assert.equal(headshotArmored.isLethal, true);
  assert.ok(headshotArmored.armorDamage > 0);
});

test('destructible cover transitions through intact -> cracked -> breached -> destroyed and triggers explosive barrels', () => {
  const crate: DestructibleCoverState = {
    id: 'crate-1',
    type: 'wood_crate',
    x: 4,
    z: -6,
    width: 1.6,
    depth: 1.6,
    height: 1.6,
    hp: 100,
    maxHp: 100,
    state: 'intact',
  };

  const hit1 = applyDamageToCover(crate, 30, false);
  assert.equal(hit1.updated.state, 'cracked');
  assert.equal(hit1.stateChanged, true);

  const hit2 = applyDamageToCover(hit1.updated, 35, false);
  assert.equal(hit2.updated.state, 'breached');

  const hit3 = applyDamageToCover(hit2.updated, 50, true);
  assert.equal(hit3.updated.state, 'destroyed');
  assert.equal(hit3.justDestroyed, true);
  assert.ok(hit3.spawnedDebrisCount >= 14);

  const barrel: DestructibleCoverState = {
    id: 'barrel-1',
    type: 'explosive_barrel',
    x: 0,
    z: 0,
    width: 1,
    depth: 1,
    height: 1.4,
    hp: 60,
    maxHp: 60,
    state: 'intact',
  };
  const barrelBoom = applyDamageToCover(barrel, 50, false);
  assert.equal(barrelBoom.justDestroyed, true);
  assert.equal(barrelBoom.triggeredExplosion, true);
});

test('blast damage falls off smoothly with distance and returns zero outside radius', () => {
  const directDamage = calculateBlastDamage(0, 0, 0.5, 0, 8, 140);
  const midDamage = calculateBlastDamage(0, 0, 4, 0, 8, 140);
  const outsideDamage = calculateBlastDamage(0, 0, 9.5, 0, 8, 140);

  assert.ok(directDamage > midDamage);
  assert.ok(midDamage > 0);
  assert.equal(outsideDamage, 0);
});

test('resolveCircleAABB pushes player out of solid walls without tunneling', () => {
  const wall = { minX: -2, maxX: 2, minZ: -1, maxZ: 1 };
  const insideCheck = resolveCircleAABB(0, 1.2, 0.5, wall);
  assert.equal(insideCheck.collided, true);
  assert.ok(insideCheck.z >= 1.49);

  const clearCheck = resolveCircleAABB(5, 5, 0.5, wall);
  assert.equal(clearCheck.collided, false);
});

test('distinct enemy archetypes produce different movement vectors and windup telegraphs', () => {
  const baseEnemy: EnemyTacticalState = {
    id: 'e1',
    archetype: 'breacher',
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    rotationY: 0,
    hp: 100,
    maxHp: 100,
    armor: 50,
    speed: 5,
    preferredRangeMin: 6,
    preferredRangeMax: 18,
    windupTimer: 0,
    windupDuration: 0.45,
    attackCooldown: 0,
    strafeDir: 1,
    strafeSwitchTimer: 2,
    hitFlashTimer: 0,
    koTimer: 0,
    alive: true,
  };

  const breacherDecision = stepEnemyBehavior({
    enemy: baseEnemy,
    playerX: 0,
    playerZ: 10,
    bombX: 0,
    bombZ: -10,
    dt: 0.016,
    hasLineOfSight: true,
    canAcquireAttackToken: true,
  });
  assert.equal(breacherDecision.startWindup, true);
  assert.ok(breacherDecision.moveZ > 0); // Advances toward player

  const marksmanTooClose = stepEnemyBehavior({
    enemy: { ...baseEnemy, archetype: 'marksman', preferredRangeMin: 14, preferredRangeMax: 32 },
    playerX: 0,
    playerZ: 8,
    bombX: 0,
    bombZ: -10,
    dt: 0.016,
    hasLineOfSight: true,
    canAcquireAttackToken: false,
  });
  assert.ok(marksmanTooClose.moveZ < 0); // Kites backward away from close player
});

test('buy menu validates cash and updates equipment inventory', () => {
  const buyArmor = processBuyMenuItem({
    itemId: 'kevlar_helmet',
    cash: 1000,
    hp: 80,
    armor: 25,
    grenades: 1,
  });
  assert.equal(buyArmor.success, true);
  assert.equal(buyArmor.nextArmor, 100);
  assert.equal(buyArmor.nextCash, 350);

  const brokeAttempt = processBuyMenuItem({
    itemId: 'combat_stim',
    cash: 200,
    hp: 40,
    armor: 100,
    grenades: 1,
  });
  assert.equal(brokeAttempt.success, false);
});

test('round outcome evaluates defusal, elimination, and defeat conditions', () => {
  assert.equal(
    evaluateRoundOutcome({
      playerHp: 0,
      bombTimerRemaining: 30,
      bombDefused: false,
      aliveEnemiesCount: 3,
      bombPlanted: true,
    }),
    'defeat_kia'
  );
  assert.equal(
    evaluateRoundOutcome({
      playerHp: 75,
      bombTimerRemaining: 12,
      bombDefused: true,
      aliveEnemiesCount: 2,
      bombPlanted: true,
    }),
    'victory_defused'
  );
  assert.equal(
    evaluateRoundOutcome({
      playerHp: 85,
      bombTimerRemaining: 25,
      bombDefused: false,
      aliveEnemiesCount: 0,
      bombPlanted: true,
    }),
    'victory_eliminated'
  );
});

test('tactical movement applies crouch stance height, counter-strafing deceleration, and crouch accuracy bonus', async () => {
  const { computeTacticalMovement, calculateEffectiveWeaponSpread } = await import('./rules');

  const crouchStep = computeTacticalMovement({
    vx: 0,
    vz: 0,
    wishX: 0,
    wishZ: -1,
    isCrouching: true,
    isWalking: false,
    isScoped: false,
    isGrounded: true,
    dt: 0.1,
  });
  assert.equal(crouchStep.stance, 'crouching');
  assert.equal(crouchStep.eyeHeightTarget, 1.06);
  assert.ok(Math.abs(crouchStep.vz) <= 3.2);

  const standingSpread = calculateEffectiveWeaponSpread({
    spec: WEAPON_SPECS.ak47,
    recoilSpread: 0.01,
    moveSpeed: 0,
    stance: 'standing',
    isScoped: false,
  });
  const crouchingSpread = calculateEffectiveWeaponSpread({
    spec: WEAPON_SPECS.ak47,
    recoilSpread: 0.01,
    moveSpeed: 0,
    stance: 'crouching',
    isScoped: false,
  });
  assert.ok(crouchingSpread < standingSpread * 0.6);
});

test('kill feed entries display player action and victim callsigns, fade out smoothly, and expire after 3 seconds', async () => {
  const {
    createKillFeedEntry,
    stepKillFeedEntries,
    getVictimTacticalCallsign,
    getCoverTacticalLabel,
  } = await import('./rules');

  const victimCallsign = getVictimTacticalCallsign('enemy-1-2', 'marksman');
  assert.equal(victimCallsign, 'MIRAGE-3 [MARKSMAN]');
  assert.equal(getCoverTacticalLabel('crate-mid-1', 'wood_crate'), 'ORDNANCE CRATE #1');

  const entry = createKillFeedEntry({
    id: 'kf-1',
    actorName: 'ALPHA-1',
    weaponId: 'ak47',
    actionLabel: 'HEADSHOT',
    victimName: victimCallsign,
    rewardCash: 450,
    isHeadshot: true,
    actionType: 'kill',
  });

  assert.equal(entry.ttlSec, 3.0);
  assert.equal(entry.opacity, 1);

  // At 1.5s, entry is still at full 1.0 opacity
  let list = stepKillFeedEntries([entry], 1.5);
  assert.equal(list.length, 1);
  assert.equal(list[0].opacity, 1);

  // At 2.55s (inside the 2.1s..3.0s fade window), opacity is ~0.5
  list = stepKillFeedEntries(list, 1.05);
  assert.equal(list.length, 1);
  assert.ok(list[0].opacity > 0.1 && list[0].opacity < 0.9);

  // At 3.05s (> 3.0s TTL), entry is automatically removed
  list = stepKillFeedEntries(list, 0.5);
  assert.equal(list.length, 0);
});


