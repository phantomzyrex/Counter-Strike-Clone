import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TacticalArenaCanvas,
  type TacticalSimulationApi,
} from './components/TacticalArenaCanvas';
import {
  TacticalHudAndShell,
  type EndOfRunSnapshot,
  type HudTelemetryState,
} from './components/TacticalHudAndShell';
import { tacticalAudio } from './game/audio';
import {
  WEAPON_SPECS,
  type BuyMenuItem,
  type GameState,
  type WeaponId,
} from './game/rules';

const INITIAL_HUD_STATE: HudTelemetryState = {
  hp: 100,
  ghostHp: 100,
  armor: 100,
  cash: 1200,
  score: 0,
  bestScore: 1500,
  wave: 1,
  activeWeapon: 'ak47',
  magAmmo: {
    ak47: WEAPON_SPECS.ak47.magSize,
    usp: WEAPON_SPECS.usp.magSize,
    awp: WEAPON_SPECS.awp.magSize,
    he_grenade: 1,
  },
  reserveAmmo: {
    ak47: WEAPON_SPECS.ak47.maxReserve,
    usp: WEAPON_SPECS.usp.maxReserve,
    awp: WEAPON_SPECS.awp.maxReserve,
    he_grenade: 2,
  },
  isReloading: false,
  reloadProgress: 0,
  isScoped: false,
  crosshairSpreadPx: 6,
  hitMarkerType: 'none',
  bombTimer: 55,
  bombDefuseProgress: 0,
  canDefuseNow: false,
  enemiesAlive: 6,
  enemiesTotal: 6,
  killsCount: 0,
  headshotsCount: 0,
  shotsFired: 0,
  shotsHit: 0,
  coverDestroyedCount: 0,
  totalCoverCount: 14,
  playerX: 0,
  playerZ: 21.5,
  playerYaw: 0,
  radarEnemies: [],
  radarCovers: [],
  killFeed: [],
  statusBanner: null,
  stance: 'standing',
  isCursorHidden: true,
  mouseSensitivity: 1.0,
};

export default function App() {
  const isAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [gameState, setGameState] = useState<GameState>(isAutostart ? 'playing' : 'title');
  const [selectedStartWeapon, setSelectedStartWeapon] = useState<'ak47' | 'awp'>('ak47');
  const [hud, setHud] = useState<HudTelemetryState>(INITIAL_HUD_STATE);
  const [endSnapshot, setEndSnapshot] = useState<EndOfRunSnapshot | null>(null);
  const [buyMenuOpen, setBuyMenuOpen] = useState<boolean>(false);
  const [buyFeedback, setBuyFeedback] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const simApiRef = useRef<TacticalSimulationApi | null>(null);

  // Mirror game state to document.body.dataset.state immediately
  const transitionToState = useCallback((next: GameState) => {
    document.body.dataset.state = next;
    setGameState(next);
    simApiRef.current?.setGameState(next);
    if (next === 'playing') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } else {
      setBuyMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const handleStartGame = useCallback(() => {
    const keepWave =
      gameState === 'gameover' &&
      endSnapshot !== null &&
      endSnapshot.outcome.startsWith('victory');
    simApiRef.current?.startNewOperation(selectedStartWeapon, keepWave);
    setEndSnapshot(null);
    setBuyMenuOpen(false);
    setBuyFeedback(null);
    transitionToState('playing');
  }, [endSnapshot, gameState, selectedStartWeapon, transitionToState]);

  const handleResumeGame = useCallback(() => {
    transitionToState('playing');
  }, [transitionToState]);

  const handleRestartGame = useCallback(() => {
    simApiRef.current?.startNewOperation(selectedStartWeapon, false);
    setEndSnapshot(null);
    setBuyMenuOpen(false);
    setBuyFeedback(null);
    transitionToState('playing');
  }, [selectedStartWeapon, transitionToState]);

  const handleReturnToTitle = useCallback(() => {
    simApiRef.current?.startNewOperation(selectedStartWeapon, false);
    setEndSnapshot(null);
    setBuyMenuOpen(false);
    setBuyFeedback(null);
    transitionToState('title');
  }, [selectedStartWeapon, transitionToState]);

  const handleTogglePause = useCallback(() => {
    if (gameState === 'playing') {
      if (buyMenuOpen) {
        setBuyMenuOpen(false);
        return;
      }
      transitionToState('paused');
    } else if (gameState === 'paused') {
      transitionToState('playing');
    }
  }, [buyMenuOpen, gameState, transitionToState]);

  const handleToggleBuyMenu = useCallback(() => {
    if (gameState !== 'playing') return;
    setBuyFeedback(null);
    setBuyMenuOpen((prev) => !prev);
  }, [gameState]);

  const handleBuyItem = useCallback((itemId: BuyMenuItem['id']) => {
    const res = simApiRef.current?.buyEquipment(itemId);
    if (res) {
      setBuyFeedback(res.message);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      tacticalAudio.setMuted(next);
      return next;
    });
  }, []);

  const handleSelectWeapon = useCallback((weaponId: WeaponId) => {
    simApiRef.current?.selectWeapon(weaponId);
  }, []);

  const handleThrowGrenade = useCallback(() => {
    simApiRef.current?.throwFragGrenade();
  }, []);

  const handleSnapTargetAndFire = useCallback(() => {
    simApiRef.current?.snapAimAndFire();
  }, []);

  const handleToggleCursorHidden = useCallback(() => {
    simApiRef.current?.toggleCursorHidden();
  }, []);

  const handleChangeSensitivity = useCallback((next: number) => {
    simApiRef.current?.setMouseSensitivity(next);
  }, []);

  const handleRoundEnd = useCallback(
    (snapshot: EndOfRunSnapshot) => {
      setEndSnapshot(snapshot);
      transitionToState('gameover');
    },
    [transitionToState]
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-stone-950">
      <TacticalArenaCanvas
        gameState={gameState}
        buyMenuOpen={buyMenuOpen}
        onHudUpdate={setHud}
        onRoundEnd={handleRoundEnd}
        onRequestPauseToggle={handleTogglePause}
        onRequestBuyToggle={handleToggleBuyMenu}
        onRequestStartFromKey={handleStartGame}
        simApiRef={simApiRef}
      />

      <TacticalHudAndShell
        gameState={gameState}
        hud={hud}
        endSnapshot={endSnapshot}
        buyMenuOpen={buyMenuOpen}
        buyFeedback={buyFeedback}
        selectedStartWeapon={selectedStartWeapon}
        isMuted={isMuted}
        onSelectStartWeapon={setSelectedStartWeapon}
        onStartGame={handleStartGame}
        onResumeGame={handleResumeGame}
        onRestartGame={handleRestartGame}
        onReturnToTitle={handleReturnToTitle}
        onTogglePause={handleTogglePause}
        onToggleMute={handleToggleMute}
        onToggleBuyMenu={handleToggleBuyMenu}
        onBuyItem={handleBuyItem}
        onSelectWeapon={handleSelectWeapon}
        onThrowGrenade={handleThrowGrenade}
        onSnapTargetAndFire={handleSnapTargetAndFire}
        onToggleCursorHidden={handleToggleCursorHidden}
        onChangeSensitivity={handleChangeSensitivity}
      />
    </main>
  );
}
