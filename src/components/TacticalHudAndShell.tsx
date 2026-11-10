import React from 'react';
import {
  BUY_MENU_ITEMS,
  WEAPON_SPECS,
  type BuyMenuItem,
  type CoverIntactState,
  type GameState,
  type KillFeedEntry,
  type RoundOutcome,
  type TacticalStance,
  type WeaponId,
} from '../game/rules';

export interface RadarEntity {
  x: number;
  z: number;
  alive: boolean;
  windup: boolean;
}

export interface RadarCover {
  x: number;
  z: number;
  state: CoverIntactState;
}

export interface HudTelemetryState {
  hp: number;
  ghostHp: number;
  armor: number;
  cash: number;
  score: number;
  bestScore: number;
  wave: number;
  activeWeapon: WeaponId;
  magAmmo: Record<WeaponId, number>;
  reserveAmmo: Record<WeaponId, number>;
  isReloading: boolean;
  reloadProgress: number; // 0..1
  isScoped: boolean;
  crosshairSpreadPx: number;
  hitMarkerType: 'none' | 'body' | 'headshot' | 'kill';
  bombTimer: number;
  bombDefuseProgress: number; // 0..1
  canDefuseNow: boolean;
  enemiesAlive: number;
  enemiesTotal: number;
  killsCount: number;
  headshotsCount: number;
  shotsFired: number;
  shotsHit: number;
  coverDestroyedCount: number;
  totalCoverCount: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  radarEnemies: RadarEntity[];
  radarCovers: RadarCover[];
  killFeed: KillFeedEntry[];
  statusBanner: string | null;
  stance: TacticalStance;
  isCursorHidden: boolean;
  mouseSensitivity: number;
}

export interface EndOfRunSnapshot {
  outcome: RoundOutcome;
  score: number;
  bestScore: number;
  wave: number;
  clearTimeSec: number;
  killsCount: number;
  headshotsCount: number;
  coverDestroyedCount: number;
  accuracyPercent: number;
  bombTimeRemaining: number;
  enemiesRemaining: number;
}

interface TacticalHudAndShellProps {
  gameState: GameState;
  hud: HudTelemetryState;
  endSnapshot: EndOfRunSnapshot | null;
  buyMenuOpen: boolean;
  buyFeedback: string | null;
  selectedStartWeapon: 'ak47' | 'awp';
  isMuted: boolean;
  onSelectStartWeapon: (w: 'ak47' | 'awp') => void;
  onStartGame: () => void;
  onResumeGame: () => void;
  onRestartGame: () => void;
  onReturnToTitle: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onToggleBuyMenu: () => void;
  onBuyItem: (itemId: BuyMenuItem['id']) => void;
  onSelectWeapon: (weaponId: WeaponId) => void;
  onThrowGrenade: () => void;
  onSnapTargetAndFire: () => void;
  onToggleCursorHidden: () => void;
  onChangeSensitivity: (next: number) => void;
}

function renderVitalitySockets(value: number, max = 100, activeHex = '#10b981', damagedHex = '#f59e0b') {
  const sockets = 5;
  const perSocket = max / sockets;
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: sockets }).map((_, idx) => {
        const thresholdFull = (idx + 0.75) * perSocket;
        const thresholdDamaged = (idx + 0.15) * perSocket;
        const state: 'full' | 'damaged' | 'empty' =
          value >= thresholdFull ? 'full' : value >= thresholdDamaged ? 'damaged' : 'empty';

        return (
          <svg key={idx} viewBox="0 0 24 24" className="w-4 h-4">
            {/* Dark outer socket silhouette */}
            <polygon
              points="4,3 20,3 22,12 18,21 6,21 2,12"
              fill="#090b0f"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.6"
            />
            {state === 'full' && (
              <>
                <polygon points="6,5 18,5 19.5,12 16.5,19 7.5,19 4.5,12" fill={activeHex} />
                <polygon points="6.5,5.5 17.5,5.5 18,8.5 6,8.5" fill="rgba(255,255,255,0.35)" />
              </>
            )}
            {state === 'damaged' && (
              <>
                <polygon points="6,5 18,5 15,12 16.5,19 7.5,19 4.5,12" fill={damagedHex} />
                <path d="M8 5 L13 12 L10 19" stroke="#090b0f" strokeWidth="2.2" fill="none" />
              </>
            )}
          </svg>
        );
      })}
    </div>
  );
}

function renderWeaponSvgIcon(weaponId: WeaponId) {
  switch (weaponId) {
    case 'ak47':
      return (
        <svg viewBox="0 0 48 20" className="w-11 h-5" aria-hidden="true">
          <path
            d="M3 12 L11 10 L11 7 L28 7 L33 9 L45 9 L45 11 L33 11 L29 13 L25 18 L21 17 L23 12 L15 12 L13 16 L10 16 L11 12 L3 15 Z"
            fill="#090b0f"
            stroke="#f4f1ea"
            strokeWidth="1.4"
          />
          <rect x="13" y="8" width="13" height="2.2" fill="#f59e0b" />
        </svg>
      );
    case 'usp':
      return (
        <svg viewBox="0 0 48 20" className="w-11 h-5" aria-hidden="true">
          <path
            d="M10 7 L28 7 L28 8.5 L42 8.5 L42 11.5 L28 11.5 L22 12 L19 18 L14 18 L16 11.5 L10 11.5 Z"
            fill="#090b0f"
            stroke="#f4f1ea"
            strokeWidth="1.4"
          />
          <rect x="29" y="9.2" width="12" height="1.6" fill="#38bdf8" />
        </svg>
      );
    case 'awp':
      return (
        <svg viewBox="0 0 48 20" className="w-11 h-5" aria-hidden="true">
          <path
            d="M2 12 L10 10 L14 8 L30 8 L46 8.5 L46 10.5 L30 11 L24 13 L15 13 L12 16 L2 15 Z"
            fill="#090b0f"
            stroke="#f4f1ea"
            strokeWidth="1.4"
          />
          <rect x="16" y="4.5" width="12" height="2.5" rx="1" fill="#10b981" />
        </svg>
      );
    case 'he_grenade':
      return (
        <svg viewBox="0 0 48 20" className="w-11 h-5" aria-hidden="true">
          <circle cx="24" cy="11.5" r="6" fill="#090b0f" stroke="#f59e0b" strokeWidth="1.6" />
          <rect x="22" y="3.5" width="4" height="3" fill="#f4f1ea" />
          <path d="M26 4.5 L31 7 L29 12" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
        </svg>
      );
  }
}

function renderKillFeedWeaponSvg(weaponId: WeaponId | 'c4_kit') {
  if (weaponId === 'c4_kit') {
    return (
      <svg viewBox="0 0 36 18" className="w-8 h-4 shrink-0" aria-hidden="true">
        <rect x="4" y="3" width="28" height="12" fill="#090b0f" stroke="#10b981" strokeWidth="1.5" />
        <circle cx="11" cy="9" r="2.2" fill="#10b981" />
        <path d="M17 6 H28 M17 12 H25" stroke="#f4f1ea" strokeWidth="1.4" />
      </svg>
    );
  }
  return <div className="scale-90 origin-center shrink-0">{renderWeaponSvgIcon(weaponId)}</div>;
}

export const TacticalHudAndShell: React.FC<TacticalHudAndShellProps> = ({
  gameState,
  hud,
  endSnapshot,
  buyMenuOpen,
  buyFeedback,
  selectedStartWeapon,
  isMuted,
  onSelectStartWeapon,
  onStartGame,
  onResumeGame,
  onRestartGame,
  onReturnToTitle,
  onTogglePause,
  onToggleMute,
  onToggleBuyMenu,
  onBuyItem,
  onSelectWeapon,
  onThrowGrenade,
  onSnapTargetAndFire,
  onToggleCursorHidden,
  onChangeSensitivity,
}) => {
  const activeSpec = WEAPON_SPECS[hud.activeWeapon];
  const currentMag = Math.round(hud.magAmmo[hud.activeWeapon] ?? 0);
  const currentReserve = Math.round(hud.reserveAmmo[hud.activeWeapon] ?? 0);
  const hpInt = Math.max(0, Math.round(hud.hp));
  const armorInt = Math.max(0, Math.round(hud.armor));
  const bombSeconds = Math.max(0, Math.ceil(hud.bombTimer));

  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden select-none">
      {/* Critical low-HP peripheral vignette */}
      {gameState === 'playing' && hpInt <= 35 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            background:
              'radial-gradient(circle at center, rgba(0,0,0,0) 48%, rgba(185, 28, 28, 0.42) 100%)',
          }}
        />
      )}

      {/* AWP Sniper Dual-Crosshair Optic Overlay when Scoped */}
      {gameState === 'playing' && hud.isScoped && (
        <div
          className="fixed inset-0 pointer-events-none flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle at center, rgba(16, 185, 129, 0.05) 34%, rgba(6, 8, 12, 0.94) 52%)',
          }}
        >
          <svg viewBox="0 0 400 400" className="w-[420px] h-[420px]">
            <circle
              cx="200"
              cy="200"
              r="185"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeOpacity="0.65"
            />
            <line x1="15" y1="200" x2="385" y2="200" stroke="#10b981" strokeWidth="1" />
            <line x1="200" y1="15" x2="200" y2="385" stroke="#10b981" strokeWidth="1" />
            <circle cx="200" cy="200" r="3" fill="#ef4444" />
          </svg>
        </div>
      )}

      {/* =====================================================================
          1. TITLE SCREEN OVERLAY (Asymmetric Left-Third over Live 3D World Pan)
         ===================================================================== */}
      {gameState === 'title' && (
        <div
          className="fixed inset-0 flex flex-col justify-between p-8 md:p-12 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(10, 12, 16, 0.88) 0%, rgba(10, 12, 16, 0.0) 14%), linear-gradient(90deg, rgba(10, 12, 16, 0.92) 0%, rgba(10, 12, 16, 0.75) 38%, rgba(10, 12, 16, 0.1) 68%, rgba(10, 12, 16, 0.0) 100%)',
          }}
        >
          {/* Left-Third Focal Lockup & Tactical Briefing */}
          <div className="max-w-md w-full my-auto pointer-events-auto space-y-6">
            {/* Custom Inline SVG Title Emblem */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono-tabular tracking-widest text-amber-400">
                <span>COUNTER-TERRORIST TASK FORCE</span>
                <span aria-hidden="true">·</span>
                <span>SITE ALPHA</span>
              </div>

              <svg
                viewBox="0 0 420 96"
                className="w-full max-w-[400px] h-auto block"
                role="img"
                aria-label="STRIKE BREACH Tactical Counter-Strike Game"
              >
                {/* Stencil Ballistic Frame */}
                <polygon
                  points="0,8 398,8 416,26 416,88 18,88 0,70"
                  fill="rgba(18, 22, 29, 0.92)"
                  stroke="#f59e0b"
                  strokeWidth="2"
                />
                <polygon points="0,8 14,8 0,22" fill="#f59e0b" />
                <polygon points="416,74 416,88 402,88" fill="#f59e0b" />
                {/* Tactical Crosshair Emblem */}
                <g transform="translate(42, 48)">
                  <circle cx="0" cy="0" r="22" fill="none" stroke="#f59e0b" strokeWidth="2.2" />
                  <circle cx="0" cy="0" r="5" fill="#ef4444" />
                  <line x1="-29" y1="0" x2="-12" y2="0" stroke="#f4f1ea" strokeWidth="2.5" />
                  <line x1="12" y1="0" x2="29" y2="0" stroke="#f4f1ea" strokeWidth="2.5" />
                  <line x1="0" y1="-29" x2="0" y2="-12" stroke="#f4f1ea" strokeWidth="2.5" />
                  <line x1="0" y1="12" x2="0" y2="29" stroke="#f4f1ea" strokeWidth="2.5" />
                </g>
                {/* Display Lockup Lettering */}
                <text
                  x="84"
                  y="52"
                  fill="#f4f1ea"
                  fontFamily="'Barlow Condensed', sans-serif"
                  fontWeight="700"
                  fontStyle="italic"
                  fontSize="44"
                  letterSpacing="2"
                >
                  STRIKE // BREACH
                </text>
                <text
                  x="86"
                  y="76"
                  fill="#d97706"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="700"
                  fontSize="12.5"
                  letterSpacing="3.2"
                >
                  DESTRUCTIBLE TACTICAL OPERATIONS
                </text>
              </svg>
            </div>

            <p className="text-sm text-stone-300 leading-relaxed max-w-sm">
              Breach the sun-baked sandstone compound, shatter reinforced barricades and ordnance
              crates with high-caliber fire or M67 fragmentation grenades, and neutralize hostile
              operatives or defuse the planted C4 at Bombsite A.
            </p>

            {/* Primary Loadout Selection */}
            <div className="space-y-2">
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-stone-400">
                Select Primary Entry Rifle (All 4 Slots Available In-Field)
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onSelectStartWeapon('ak47')}
                  className={`p-3 text-left transition-colors border ${
                    selectedStartWeapon === 'ak47'
                      ? 'bg-amber-500/20 border-amber-400 text-stone-100'
                      : 'bg-stone-900/85 border-stone-700/80 text-stone-300 hover:border-stone-500'
                  }`}
                >
                  <div className="font-display text-lg font-bold tracking-wide uppercase">
                    AK-47M Kalash
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">
                    Full-Auto · High Cover Fracture
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectStartWeapon('awp')}
                  className={`p-3 text-left transition-colors border ${
                    selectedStartWeapon === 'awp'
                      ? 'bg-amber-500/20 border-amber-400 text-stone-100'
                      : 'bg-stone-900/85 border-stone-700/80 text-stone-300 hover:border-stone-500'
                  }`}
                >
                  <div className="font-display text-lg font-bold tracking-wide uppercase">
                    AWP Magnum .338
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">
                    One-Shot Lethal · Optic Zoom
                  </div>
                </button>
              </div>
            </div>

            {/* Primary Start CTA with data-start="true" */}
            <div className="pt-1 flex items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={onStartGame}
                className="px-7 py-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-display text-xl font-bold tracking-wider uppercase transition-transform active:scale-98 cursor-pointer shadow-lg"
              >
                Deploy To Site Alpha [Enter]
              </button>

              <button
                type="button"
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                onClick={onToggleMute}
                className="px-4 py-3.5 bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono-tabular text-xs uppercase cursor-pointer"
              >
                {isMuted ? 'Audio: Muted' : 'Audio: Live'}
              </button>
            </div>
          </div>

          {/* Single Flat Borderless Inline Control Hint Line in Bottom Safe Margin */}
          <div className="text-xs font-mono-tabular text-stone-300 tracking-wide">
            WASD Move · Mouse / Arrows Aim · Right Alt Cursor Toggle · Ctrl/C Crouch · Shift Walk ·
            Z/X Lean · Q Quick-Switch · 1-4 / Wheel Weapons · G Frag · E Defuse · B Armory
          </div>
        </div>
      )}

      {/* =====================================================================
          2. ACTIVE PLAYING HUD (<= 3 Perimeter Clusters, >= 85% Clear Playfield)
         ===================================================================== */}
      {gameState === 'playing' && (
        <>
          {/* CENTER (0, 0) DYNAMIC BALLISTIC CROSSHAIR & GAZE-ROUTED CUES */}
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center"
            aria-hidden="true"
          >
            {/* Dynamic 4-Prong Crosshair */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Center dot */}
              <div className="w-1 h-1 bg-amber-400 rounded-full" />
              {/* Top prong */}
              <div
                className="absolute w-0.5 h-2.5 bg-emerald-400 shadow"
                style={{
                  transform: `translateY(-${Math.round(8 + hud.crosshairSpreadPx)}px)`,
                }}
              />
              {/* Bottom prong */}
              <div
                className="absolute w-0.5 h-2.5 bg-emerald-400 shadow"
                style={{
                  transform: `translateY(${Math.round(8 + hud.crosshairSpreadPx)}px)`,
                }}
              />
              {/* Left prong */}
              <div
                className="absolute h-0.5 w-2.5 bg-emerald-400 shadow"
                style={{
                  transform: `translateX(-${Math.round(8 + hud.crosshairSpreadPx)}px)`,
                }}
              />
              {/* Right prong */}
              <div
                className="absolute h-0.5 w-2.5 bg-emerald-400 shadow"
                style={{
                  transform: `translateX(${Math.round(8 + hud.crosshairSpreadPx)}px)`,
                }}
              />

              {/* Hit Marker Diagonal Cross */}
              {hud.hitMarkerType !== 'none' && (
                <svg viewBox="0 0 36 36" className="w-9 h-9 absolute">
                  <line
                    x1="6"
                    y1="6"
                    x2="13"
                    y2="13"
                    stroke={
                      hud.hitMarkerType === 'headshot' || hud.hitMarkerType === 'kill'
                        ? '#ef4444'
                        : '#f4f1ea'
                    }
                    strokeWidth="2.4"
                  />
                  <line
                    x1="30"
                    y1="6"
                    x2="23"
                    y2="13"
                    stroke={
                      hud.hitMarkerType === 'headshot' || hud.hitMarkerType === 'kill'
                        ? '#ef4444'
                        : '#f4f1ea'
                    }
                    strokeWidth="2.4"
                  />
                  <line
                    x1="6"
                    y1="30"
                    x2="13"
                    y2="23"
                    stroke={
                      hud.hitMarkerType === 'headshot' || hud.hitMarkerType === 'kill'
                        ? '#ef4444'
                        : '#f4f1ea'
                    }
                    strokeWidth="2.4"
                  />
                  <line
                    x1="30"
                    y1="30"
                    x2="23"
                    y2="23"
                    stroke={
                      hud.hitMarkerType === 'headshot' || hud.hitMarkerType === 'kill'
                        ? '#ef4444'
                        : '#f4f1ea'
                    }
                    strokeWidth="2.4"
                  />
                </svg>
              )}

              {/* Gaze-Routed Circular Reload Progress Arc */}
              {hud.isReloading && (
                <svg viewBox="0 0 56 56" className="w-14 h-14 absolute -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeDasharray={138.2}
                    strokeDashoffset={138.2 * (1 - hud.reloadProgress)}
                  />
                </svg>
              )}
            </div>

            {/* C4 Defusal Prompt / Progress Bar routed near center gaze */}
            {(hud.canDefuseNow || hud.bombDefuseProgress > 0) && (
              <div
                className="absolute top-20 px-3.5 py-2 border border-amber-400/70 text-center min-w-[210px]"
                style={{ backgroundColor: 'rgba(12, 15, 20, 0.88)' }}
              >
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-amber-300">
                  {hud.bombDefuseProgress > 0
                    ? `DEFUSING C4 ORDNANCE · ${Math.round(hud.bombDefuseProgress * 100)}%`
                    : 'HOLD [E] TO DEFUSE PLANTED C4'}
                </div>
                {hud.bombDefuseProgress > 0 && (
                  <div className="w-full h-1.5 bg-stone-800 mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${Math.round(hud.bombDefuseProgress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CLUSTER 1 (TOP-CENTER + TOP-RIGHT): ROUND CLOCK, RADAR MINIMAP & UTILITY CONTROLS */}
          <div className="fixed top-3 inset-x-4 flex items-start justify-between pointer-events-none">
            {/* Top-Left Tactical Status Banner & Visual 3-Second Kill Feed List */}
            <div className="space-y-1.5 min-w-[320px] max-w-md">
              {hud.statusBanner && (
                <div
                  className="px-3 py-1.5 border border-amber-500/50 text-xs font-mono-tabular text-amber-300 uppercase tracking-wider"
                  style={{ backgroundColor: 'rgba(12, 15, 20, 0.86)' }}
                >
                  {hud.statusBanner}
                </div>
              )}
              <div
                data-testid="hud-killfeed-list"
                aria-live="polite"
                className="space-y-1.5"
              >
                {hud.killFeed.map((item) => {
                  const lifeRatio = Math.max(
                    0,
                    Math.min(1, 1 - item.ageSec / Math.max(0.1, item.ttlSec))
                  );
                  const borderAccent = item.isHeadshot
                    ? 'border-red-500/80'
                    : item.actionType === 'kill'
                      ? 'border-amber-500/70'
                      : item.actionType === 'defuse'
                        ? 'border-emerald-500/80'
                        : 'border-stone-600/80';

                  return (
                    <div
                      key={item.id}
                      data-testid="hud-killfeed-item"
                      data-opacity={item.opacity.toFixed(2)}
                      className={`relative overflow-hidden px-3 py-1.5 border ${borderAccent} transition-opacity duration-75`}
                      style={{
                        backgroundColor: 'rgba(12, 15, 20, 0.90)',
                        opacity: Number(item.opacity.toFixed(3)),
                      }}
                    >
                      <div className="flex items-center justify-between gap-2.5 text-xs font-mono-tabular">
                        {/* Player Actor Callsign */}
                        <span
                          data-testid="killfeed-actor"
                          className="text-emerald-400 font-bold tracking-wider uppercase shrink-0"
                        >
                          {item.actorName}
                        </span>

                        {/* Weapon Silhouette + Action Tag + Headshot Reticle */}
                        <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-stone-950/90 border border-stone-800 shrink-0">
                          {renderKillFeedWeaponSvg(item.weaponId)}
                          <span
                            data-testid="killfeed-action"
                            className={`text-[10px] font-bold tracking-wider uppercase ${
                              item.isHeadshot
                                ? 'text-red-400'
                                : item.actionType === 'kill'
                                  ? 'text-amber-300'
                                  : item.actionType === 'defuse'
                                    ? 'text-emerald-300'
                                    : 'text-stone-300'
                            }`}
                          >
                            {item.actionLabel}
                          </span>
                          {item.isHeadshot && (
                            <svg
                              viewBox="0 0 16 16"
                              className="w-3.5 h-3.5 text-red-400 shrink-0"
                              aria-label="Headshot"
                            >
                              <circle
                                cx="8"
                                cy="8"
                                r="5.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                              />
                              <circle cx="8" cy="8" r="1.8" fill="currentColor" />
                              <path
                                d="M8 1 V4 M8 12 V15 M1 8 H4 M12 8 H15"
                                stroke="currentColor"
                                strokeWidth="1.4"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Victim Callsign / Target Name */}
                        <span
                          data-testid="killfeed-victim"
                          className={`font-bold tracking-wide uppercase truncate ${
                            item.actionType === 'kill'
                              ? 'text-red-300'
                              : item.actionType === 'defuse'
                                ? 'text-emerald-300'
                                : 'text-amber-200'
                          }`}
                        >
                          {item.victimName}
                        </span>

                        {/* Tactical Cash Bounty */}
                        <span className="text-[11px] font-bold text-emerald-400 shrink-0">
                          +${item.rewardCash}
                        </span>
                      </div>

                      {/* 3-Second Lifetime Progress Bar */}
                      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-stone-900">
                        <div
                          className={`h-full ${
                            item.isHeadshot
                              ? 'bg-red-500'
                              : item.actionType === 'kill'
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.round(lifeRatio * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top-Center Tactical Scoreboard & C4 Countdown */}
            <div
              className="px-5 py-2 border border-stone-700/80 flex items-center gap-6"
              style={{ backgroundColor: 'rgba(12, 15, 20, 0.88)' }}
            >
              <div className="text-center">
                <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-stone-400">
                  OPERATION
                </div>
                <div className="font-display text-2xl font-bold text-stone-100 leading-none font-mono-tabular">
                  WAVE {hud.wave}
                </div>
              </div>

              <div className="h-7 w-px bg-stone-700/70" />

              {/* C4 Bomb Countdown Readout */}
              <div className="text-center">
                <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-red-400">
                  SITE A · C4 TIMER
                </div>
                <div
                  className={`font-display text-3xl font-bold leading-none font-mono-tabular ${
                    bombSeconds <= 12 ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  00:{String(bombSeconds).padStart(2, '0')}
                </div>
              </div>

              <div className="h-7 w-px bg-stone-700/70" />

              <div className="text-center">
                <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-stone-400">
                  HOSTILES
                </div>
                <div className="font-display text-2xl font-bold text-stone-100 leading-none font-mono-tabular">
                  {hud.enemiesAlive} / {hud.enemiesTotal}
                </div>
              </div>

              <div className="h-7 w-px bg-stone-700/70" />

              <div className="text-center">
                <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-emerald-400">
                  FUNDS
                </div>
                <div
                  data-testid="hud-cash"
                  className="font-display text-2xl font-bold text-emerald-400 leading-none font-mono-tabular"
                >
                  ${Math.round(hud.cash)}
                </div>
              </div>
            </div>

            {/* Top-Right Live Tactical Radar Minimap + Square Utility Icon Buttons */}
            <div className="flex items-start gap-2.5 pointer-events-auto">
              {/* Live 2D Radar Minimap projecting real level geometry */}
              <div
                className="w-28 h-28 border border-stone-600/80 relative overflow-hidden"
                style={{ backgroundColor: 'rgba(10, 14, 18, 0.9)' }}
                aria-label="Tactical Radar Minimap"
              >
                <svg viewBox="-30 -30 60 60" className="w-full h-full">
                  {/* Compound Perimeter */}
                  <rect
                    x="-28"
                    y="-28"
                    width="56"
                    height="56"
                    fill="none"
                    stroke="rgba(212,188,148,0.35)"
                    strokeWidth="1.2"
                  />
                  {/* Interior Partitions */}
                  <rect x="-14.6" y="-10.2" width="3.2" height="8.5" fill="rgba(212,188,148,0.4)" />
                  <rect x="-14.6" y="5.8" width="3.2" height="6.5" fill="rgba(212,188,148,0.4)" />
                  <rect x="11.4" y="-9.5" width="3.2" height="9.0" fill="rgba(212,188,148,0.4)" />
                  <rect x="11.4" y="7.0" width="3.2" height="6.0" fill="rgba(212,188,148,0.4)" />

                  {/* Bombsite A Marker */}
                  <circle cx="0" cy="-16.5" r="2.8" fill="rgba(239,68,68,0.28)" stroke="#ef4444" strokeWidth="0.9" />

                  {/* Destructible Cover Dots */}
                  {hud.radarCovers.map((c, idx) =>
                    c.state !== 'destroyed' ? (
                      <rect
                        key={idx}
                        x={c.x - 0.9}
                        y={c.z - 0.9}
                        width="1.8"
                        height="1.8"
                        fill={c.state === 'intact' ? '#d97706' : '#78716c'}
                      />
                    ) : null
                  )}

                  {/* Hostile Operatives */}
                  {hud.radarEnemies.map((e, idx) =>
                    e.alive ? (
                      <circle
                        key={idx}
                        cx={e.x}
                        cy={e.z}
                        r={e.windup ? 2.1 : 1.5}
                        fill={e.windup ? '#facc15' : '#ef4444'}
                      />
                    ) : null
                  )}

                  {/* Player Position & View Cone */}
                  <g
                    transform={`translate(${hud.playerX}, ${hud.playerZ}) rotate(${
                      (-hud.playerYaw * 180) / Math.PI
                    })`}
                  >
                    <polygon points="0,0 -5,-11 5,-11" fill="rgba(16, 185, 129, 0.28)" />
                    <circle cx="0" cy="0" r="1.8" fill="#10b981" />
                  </g>
                </svg>
                <div className="absolute bottom-0.5 left-1 text-[9px] font-mono-tabular text-stone-400">
                  SITE ALPHA
                </div>
              </div>

              {/* Compact Utility Controls */}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Tactical Buy Armory [B]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleBuyMenu();
                  }}
                  className="w-9 h-9 flex items-center justify-center border border-amber-500/70 bg-stone-900/90 hover:bg-amber-500/20 text-amber-400 text-xs font-mono-tabular font-bold cursor-pointer"
                  title="Buy Armory [B]"
                >
                  $B
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-cursor-toggle"
                  aria-label="Toggle Main Cursor [Right Alt]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleCursorHidden();
                  }}
                  className={`w-9 h-9 flex items-center justify-center border text-[10px] font-mono-tabular font-bold cursor-pointer ${
                    hud.isCursorHidden
                      ? 'border-emerald-500/70 bg-stone-900/90 hover:bg-emerald-500/20 text-emerald-400'
                      : 'border-amber-400 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
                  }`}
                  title="Toggle Main Cursor Visibility [Right Alt]"
                >
                  {hud.isCursorHidden ? 'LOCK' : 'CUR'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Snap Aim & Fire [T]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSnapTargetAndFire();
                  }}
                  className="w-9 h-9 flex items-center justify-center border border-stone-600 bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-mono-tabular font-bold cursor-pointer"
                  title="Tactical Target Snap & Fire [T]"
                >
                  AIM
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={isMuted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleMute();
                  }}
                  className="w-9 h-9 flex items-center justify-center border border-stone-600 bg-stone-900/90 hover:bg-stone-800 text-stone-200 cursor-pointer"
                  title="Mute / Unmute [M]"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    {isMuted ? (
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3l3.5 3.5-1.5 1.5L15 13.5l-3.5 3.5-1.5-1.5L13.5 12 10 8.5 11.5 7 15 10.5 18.5 7 20 8.5 16.5 12z" />
                    ) : (
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    )}
                  </svg>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Pause Operation [P]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTogglePause();
                  }}
                  className="w-9 h-9 flex items-center justify-center border border-stone-600 bg-stone-900/90 hover:bg-stone-800 text-stone-200 cursor-pointer"
                  title="Pause [P / Esc]"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Restart Operation [R]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onRestartGame();
                  }}
                  className="w-9 h-9 flex items-center justify-center border border-stone-600 bg-stone-900/90 hover:bg-stone-800 text-stone-200 cursor-pointer"
                  title="Restart Operation"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* CLUSTER 2 (BOTTOM-LEFT): VITALITY & BALLISTIC ARMOR READOUT */}
          <div
            className="fixed bottom-4 left-4 p-3.5 border border-stone-700/80 min-w-[270px]"
            style={{ backgroundColor: 'rgba(12, 15, 20, 0.88)' }}
          >
            <div className="flex items-end justify-between gap-5">
              {/* Health Readout */}
              <div>
                <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-stone-400">
                  HP · VITALITY
                </div>
                <div className="flex items-center gap-2.5 mt-0.5">
                  <span
                    data-testid="hud-hp"
                    className={`font-display text-4xl font-bold leading-none font-mono-tabular hud-stroke ${
                      hpInt <= 30 ? 'text-red-400' : 'text-stone-100'
                    }`}
                  >
                    {hpInt}
                  </span>
                  {renderVitalitySockets(hpInt, 100, '#10b981', '#ef4444')}
                </div>
              </div>

              {/* Armor Readout */}
              <div>
                <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-stone-400">
                  KEVLAR · AP
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    data-testid="hud-armor"
                    className="font-display text-4xl font-bold leading-none font-mono-tabular text-sky-400 hud-stroke"
                  >
                    {armorInt}
                  </span>
                  {renderVitalitySockets(armorInt, 100, '#38bdf8', '#f59e0b')}
                </div>
              </div>
            </div>

            {/* Continuous Vitality Bar with Delayed Trailing Damage Ghost Bar */}
            <div className="w-full h-2 bg-stone-950 mt-2.5 relative overflow-hidden border border-stone-800">
              <div
                className="position-absolute inset-y-0 left-0 h-full bg-amber-500/70 transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, Math.round(hud.ghostHp)))}%` }}
              />
              <div
                className={`absolute inset-y-0 left-0 h-full ${
                  hpInt <= 30 ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, hpInt))}%` }}
              />
            </div>

            {/* Tactical Stance & Right-Alt Cursor Mode Readout */}
            <div className="mt-2 pt-1.5 border-t border-stone-800/90 flex items-center justify-between gap-3 text-[10px] font-mono-tabular uppercase tracking-wider">
              <span
                data-testid="hud-stance"
                className={
                  hud.stance === 'crouching'
                    ? 'text-emerald-400 font-bold'
                    : hud.stance === 'walking'
                      ? 'text-sky-400 font-bold'
                      : hud.stance === 'airborne'
                        ? 'text-amber-400 font-bold'
                        : 'text-stone-300'
                }
              >
                {hud.stance === 'crouching'
                  ? 'STANCE: CROUCH [-48% SPREAD]'
                  : hud.stance === 'walking'
                    ? 'STANCE: WALK [SILENT]'
                    : hud.stance === 'airborne'
                      ? 'STANCE: AIRBORNE'
                      : 'STANCE: STANDING'}
              </span>
              <span
                data-testid="hud-cursor-state"
                className={hud.isCursorHidden ? 'text-stone-400' : 'text-amber-300 font-bold'}
              >
                {hud.isCursorHidden ? 'AIM LOCK [R-ALT]' : 'CURSOR FREE [R-ALT]'}
              </span>
            </div>
          </div>

          {/* CLUSTER 3 (BOTTOM-RIGHT): AMMO COUNTER, DESTRUCTION TELEMETRY & WEAPON SLOTS */}
          <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-auto">
            {/* Weapon Slot Selector Strip ([1] - [4]) */}
            <div className="flex items-center gap-1.5">
              {(['ak47', 'usp', 'awp', 'he_grenade'] as WeaponId[]).map((wId) => {
                const spec = WEAPON_SPECS[wId];
                const isSelected = hud.activeWeapon === wId;
                const mag = Math.round(hud.magAmmo[wId] ?? 0);
                const res = Math.round(hud.reserveAmmo[wId] ?? 0);
                return (
                  <button
                    key={wId}
                    type="button"
                    tabIndex={-1}
                    aria-label={`Select ${spec.name} Slot ${spec.slot}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectWeapon(wId);
                    }}
                    className={`px-2.5 py-1.5 border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-stone-900/95 text-stone-100'
                        : 'border-stone-700/80 bg-stone-950/85 text-stone-400 hover:border-stone-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular">
                      <span className="text-amber-400 font-bold">[{spec.slot}]</span>
                      <span>
                        {mag}/{res}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {renderWeaponSvgIcon(wId)}
                      <span className="font-display text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                        {spec.shortCode}
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* Quick Frag Throw Button */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Throw Frag Grenade [G]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onThrowGrenade();
                }}
                className="px-2.5 py-1.5 border border-amber-500/70 bg-stone-900/95 hover:bg-amber-500/20 text-amber-300 cursor-pointer flex flex-col justify-between h-full"
              >
                <span className="text-[10px] font-mono-tabular font-bold">[G] BREACH</span>
                <span className="font-display text-xs font-bold uppercase whitespace-nowrap">
                  THROW HE ({Math.round((hud.magAmmo.he_grenade ?? 0) + (hud.reserveAmmo.he_grenade ?? 0))})
                </span>
              </button>
            </div>

            {/* Primary Ammo & Cover Destruction Telemetry Card */}
            <div
              className="p-3.5 border border-stone-700/80 min-w-[310px] flex items-end justify-between gap-6 pointer-events-none"
              style={{ backgroundColor: 'rgba(12, 15, 20, 0.88)' }}
            >
              <div>
                <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400">
                  {activeSpec.roleClue}
                </div>
                <div className="font-display text-xl font-bold uppercase text-stone-100 mt-0.5">
                  {activeSpec.name}
                </div>
                <div className="text-[11px] font-mono-tabular text-stone-400 mt-1">
                  COVER BREACHED:{' '}
                  <span data-testid="hud-breached" className="text-amber-300 font-bold">
                    {hud.coverDestroyedCount} / {hud.totalCoverCount}
                  </span>{' '}
                  · SCORE: <span className="text-stone-100 font-bold">{Math.round(hud.score)}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-stone-400">
                  {hud.isReloading ? 'RELOADING' : 'ORDNANCE'}
                </div>
                <div className="flex items-baseline justify-end gap-1.5 mt-0.5 font-mono-tabular">
                  <span
                    data-testid="hud-ammo-mag"
                    className={`font-display text-4xl font-bold leading-none hud-stroke ${
                      currentMag <= Math.ceil(activeSpec.magSize * 0.25)
                        ? 'text-red-400'
                        : 'text-stone-100'
                    }`}
                  >
                    {currentMag}
                  </span>
                  <span className="text-stone-500 text-xl font-bold">/</span>
                  <span
                    data-testid="hud-ammo-reserve"
                    className="font-display text-2xl font-bold text-stone-400 leading-none"
                  >
                    {currentReserve}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          3. TACTICAL ARMORY BUY MENU MODAL ([B])
         ===================================================================== */}
      {gameState === 'playing' && buyMenuOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto"
          style={{ backgroundColor: 'rgba(8, 10, 14, 0.78)' }}
        >
          <div
            role="dialog"
            aria-label="Tactical Buy Armory"
            className="w-full max-w-lg border border-amber-500/70 p-6 space-y-5"
            style={{ backgroundColor: 'rgba(14, 18, 24, 0.96)' }}
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <div className="text-xs font-mono-tabular uppercase tracking-widest text-amber-400">
                  FIELD REQUISITION · SITE ALPHA
                </div>
                <h2 className="font-display text-3xl font-bold uppercase text-stone-100">
                  Tactical Armory & Ordnance
                </h2>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono-tabular text-stone-400">AVAILABLE FUNDS</div>
                <div className="font-display text-3xl font-bold text-emerald-400 font-mono-tabular">
                  ${Math.round(hud.cash)}
                </div>
              </div>
            </div>

            {buyFeedback && (
              <div className="px-3 py-2 border border-amber-500/50 bg-amber-500/10 text-xs font-mono-tabular text-amber-300">
                {buyFeedback}
              </div>
            )}

            <div className="space-y-2.5">
              {BUY_MENU_ITEMS.map((item) => {
                const canAfford = hud.cash >= item.cost;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onBuyItem(item.id)}
                    className={`w-full p-3.5 border text-left flex items-center justify-between transition-colors cursor-pointer ${
                      canAfford
                        ? 'border-stone-700 bg-stone-900/90 hover:border-amber-400 text-stone-100'
                        : 'border-stone-800 bg-stone-950/60 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    <div className="pr-4">
                      <div className="font-display text-lg font-bold uppercase tracking-wide">
                        [{item.hotkey}] {item.name}
                      </div>
                      <div className="text-xs text-stone-400 mt-0.5">{item.description}</div>
                    </div>
                    <div
                      className={`font-mono-tabular text-lg font-bold shrink-0 ${
                        canAfford ? 'text-emerald-400' : 'text-stone-500'
                      }`}
                    >
                      ${item.cost}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-800">
              <span className="text-xs font-mono-tabular text-stone-400">
                Press [B] or Close to return to combat
              </span>
              <button
                type="button"
                onClick={onToggleBuyMenu}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display text-base font-bold uppercase tracking-wider cursor-pointer"
              >
                Close Armory [B]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. PAUSE MODAL ('paused')
         ===================================================================== */}
      {gameState === 'paused' && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto"
          style={{ backgroundColor: 'rgba(8, 10, 14, 0.84)' }}
        >
          <div
            role="dialog"
            aria-label="Operation Paused"
            className="w-full max-w-md border border-stone-700 p-6 space-y-6"
            style={{ backgroundColor: 'rgba(14, 18, 24, 0.96)' }}
          >
            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-widest text-amber-400">
                TACTICAL STANDBY
              </div>
              <h2 className="font-display text-4xl font-bold uppercase text-stone-100 mt-0.5">
                Operation Paused
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-stone-900 border border-stone-800">
                <div className="text-[10px] font-mono-tabular uppercase text-stone-400">SCORE</div>
                <div className="font-display text-2xl font-bold font-mono-tabular text-stone-100">
                  {Math.round(hud.score)}
                </div>
              </div>
              <div className="p-3 bg-stone-900 border border-stone-800">
                <div className="text-[10px] font-mono-tabular uppercase text-stone-400">
                  HOSTILES LEFT
                </div>
                <div className="font-display text-2xl font-bold font-mono-tabular text-amber-400">
                  {hud.enemiesAlive}
                </div>
              </div>
              <div className="p-3 bg-stone-900 border border-stone-800">
                <div className="text-[10px] font-mono-tabular uppercase text-stone-400">
                  BREACHED
                </div>
                <div className="font-display text-2xl font-bold font-mono-tabular text-emerald-400">
                  {hud.coverDestroyedCount}/{hud.totalCoverCount}
                </div>
              </div>
            </div>

            {/* Tactical Control & Cursor Settings in Pause Menu */}
            <div className="p-3.5 bg-stone-900/90 border border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono-tabular uppercase text-stone-200 font-bold">
                    MOUSE AIM SENSITIVITY
                  </div>
                  <div className="text-[11px] font-mono-tabular text-stone-400">
                    Adjust in-field with [ and ] keys
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSensitivity(Math.max(0.4, Math.round((hud.mouseSensitivity - 0.15) * 100) / 100))
                    }
                    className="w-8 h-8 bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-100 font-mono-tabular font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <span
                    data-testid="hud-sensitivity"
                    className="font-mono-tabular text-sm font-bold text-amber-400 min-w-[44px] text-center"
                  >
                    {hud.mouseSensitivity.toFixed(2)}x
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSensitivity(Math.min(2.5, Math.round((hud.mouseSensitivity + 0.15) * 100) / 100))
                    }
                    className="w-8 h-8 bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-100 font-mono-tabular font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                <div className="text-xs font-mono-tabular text-stone-300">
                  Main Cursor Mode:{' '}
                  <span className="text-amber-400 font-bold">
                    {hud.isCursorHidden ? 'HIDDEN (360° AIM)' : 'VISIBLE (UI CURSOR)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleCursorHidden}
                  className="px-3 py-1 bg-stone-800 hover:bg-stone-700 border border-stone-600 text-xs font-mono-tabular text-stone-200 uppercase cursor-pointer"
                >
                  Toggle [Right Alt]
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResumeGame}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display text-xl font-bold uppercase tracking-wider cursor-pointer"
              >
                Resume Operation [Esc / P]
              </button>
              <button
                type="button"
                onClick={onRestartGame}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-100 font-display text-lg font-bold uppercase tracking-wider cursor-pointer"
              >
                Restart Wave
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 font-display text-lg font-bold uppercase tracking-wider cursor-pointer"
              >
                Return To Briefing Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. VICTORY / GAME OVER OUTCOME MODAL ('gameover')
         ===================================================================== */}
      {gameState === 'gameover' && endSnapshot && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto"
          style={{ backgroundColor: 'rgba(8, 10, 14, 0.88)' }}
        >
          <div
            role="dialog"
            aria-label={
              endSnapshot.outcome.startsWith('victory') ? 'Operation Victory' : 'Operation Defeat'
            }
            className={`w-full max-w-lg border p-7 space-y-6 ${
              endSnapshot.outcome.startsWith('victory')
                ? 'border-emerald-500/80'
                : 'border-red-500/80'
            }`}
            style={{ backgroundColor: 'rgba(14, 18, 24, 0.96)' }}
          >
            <div>
              <div
                className={`text-xs font-mono-tabular uppercase tracking-widest ${
                  endSnapshot.outcome.startsWith('victory') ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {endSnapshot.outcome === 'victory_defused'
                  ? 'COUNTER-TERRORIST VICTORY · C4 ORDNANCE DEFUSED'
                  : endSnapshot.outcome === 'victory_eliminated'
                    ? 'COUNTER-TERRORIST VICTORY · ALL HOSTILES NEUTRALIZED'
                    : endSnapshot.outcome === 'defeat_detonated'
                      ? 'MISSION FAILURE · SITE ALPHA C4 DETONATED'
                      : 'MISSION FAILURE · OPERATIVE KILLED IN ACTION'}
              </div>
              <h2 className="font-display text-4xl font-bold uppercase text-stone-100 mt-1">
                {endSnapshot.outcome.startsWith('victory')
                  ? `Site Alpha Secured (Wave ${endSnapshot.wave})`
                  : 'Operation Compromised'}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 bg-stone-900 border border-stone-800">
                <div className="text-[10px] font-mono-tabular uppercase text-stone-400">
                  SCORE / BEST
                </div>
                <div className="font-display text-2xl font-bold font-mono-tabular text-stone-100 mt-0.5">
                  {Math.round(endSnapshot.score)} / {Math.round(endSnapshot.bestScore)}
                </div>
              </div>
              <div className="p-3.5 bg-stone-900 border border-stone-800">
                <div className="text-[10px] font-mono-tabular uppercase text-stone-400">
                  NEUTRALIZED (HS)
                </div>
                <div className="font-display text-2xl font-bold font-mono-tabular text-amber-400 mt-0.5">
                  {endSnapshot.killsCount} ({endSnapshot.headshotsCount} HS)
                </div>
              </div>
              <div className="p-3.5 bg-stone-900 border border-stone-800">
                <div className="text-[10px] font-mono-tabular uppercase text-stone-400">
                  COVER BREACHED
                </div>
                <div className="font-display text-2xl font-bold font-mono-tabular text-emerald-400 mt-0.5">
                  {endSnapshot.coverDestroyedCount} PROPS
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono-tabular text-stone-400 border-t border-b border-stone-800 py-2.5">
              <span>OPERATION TIME: {Math.round(endSnapshot.clearTimeSec)}s</span>
              <span>ACCURACY: {Math.round(endSnapshot.accuracyPercent)}%</span>
              <span>C4 REMAINING: {Math.round(endSnapshot.bombTimeRemaining)}s</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={onStartGame}
                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display text-xl font-bold uppercase tracking-wider cursor-pointer"
              >
                {endSnapshot.outcome.startsWith('victory')
                  ? 'Deploy Next Wave [Enter]'
                  : 'Try Operation Again [Enter]'}
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="px-5 py-3.5 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 font-display text-lg font-bold uppercase tracking-wider cursor-pointer"
              >
                Briefing Title
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
