import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productBrand } from '../constants/branding';
import { projectTemplateOptions } from '../constants/projectTemplates';
import { supabase } from '../lib/supabase';

const GAME_WIDTH = 600;
const GAME_HEIGHT = 150;
const GROUND_Y = 116;
const DINO_SIZE = 20;
const DINO_X = 52;
const OBSTACLE_WIDTH = 14;

function OfflineRunnerGame() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [slowStart, setSlowStart] = useState(true);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  const [dinoY, setDinoY] = useState(0);
  const [obstacleX, setObstacleX] = useState(GAME_WIDTH + 80);

  const velocityRef = useRef(0);
  const dinoYRef = useRef(0);
  const obstacleXRef = useRef(GAME_WIDTH + 80);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const scoreRef = useRef(0);

  const resetGame = () => {
    velocityRef.current = 0;
    dinoYRef.current = 0;
    obstacleXRef.current = GAME_WIDTH + 80;
    scoreRef.current = 0;
    setDinoY(0);
    setObstacleX(GAME_WIDTH + 80);
    setScore(0);
    setGameOver(false);
  };

  const jump = () => {
    if (!isPlaying) {
      resetGame();
      setIsPlaying(true);
      return;
    }

    if (dinoYRef.current <= 0.01) {
      velocityRef.current = slowStart ? 8.2 : 10.4;
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }

      event.preventDefault();
      jump();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isPlaying, slowStart]);

  useEffect(() => {
    if (!isPlaying) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const tick = (time: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = time;
      }

      const elapsed = time - (lastTimeRef.current ?? time);
      lastTimeRef.current = time;
      const step = Math.min(2.4, elapsed / 16.667);

      const gravity = slowStart ? 0.42 : 0.54;
      const speed = slowStart ? 3.8 : 5.5;

      velocityRef.current -= gravity * step;
      dinoYRef.current = Math.max(0, dinoYRef.current + velocityRef.current * step);

      obstacleXRef.current -= speed * step;
      if (obstacleXRef.current < -OBSTACLE_WIDTH) {
        obstacleXRef.current = GAME_WIDTH + 80 + Math.random() * 200;
      }

      scoreRef.current += 0.26 * step;
      const nextScore = Math.floor(scoreRef.current);

      setDinoY(dinoYRef.current);
      setObstacleX(obstacleXRef.current);
      setScore(nextScore);

      const dinoTop = GROUND_Y - dinoYRef.current - DINO_SIZE;
      const obstacleTop = GROUND_Y - 22;
      const overlapX = DINO_X + DINO_SIZE > obstacleXRef.current && DINO_X < obstacleXRef.current + OBSTACLE_WIDTH;
      const overlapY = dinoTop + DINO_SIZE > obstacleTop;

      if (overlapX && overlapY) {
        setIsPlaying(false);
        setGameOver(true);
        setBestScore((currentBest) => Math.max(currentBest, nextScore));
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isPlaying, slowStart]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
      <p className="text-sm uppercase tracking-[0.32em] text-teal-200/80">Offline Game</p>
      <h3 className="mt-3 text-2xl font-semibold text-white">Press space to play</h3>
      <p className="mt-2 text-sm text-slate-300">No internet. Jump over obstacles and beat your best score.</p>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.2em] text-slate-400">
        <span>Score: {score}</span>
        <span>Best: {bestScore}</span>
        <span className="text-amber-200">{gameOver ? 'ERR_INTERNET_DISCONNECTED' : 'Online status unavailable'}</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div
          role="application"
          tabIndex={0}
          aria-label="Dino game, press space to play"
          className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950/70"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          onClick={jump}
        >
          <div className="absolute left-0 right-0 border-t border-dashed border-slate-600" style={{ top: GROUND_Y }} />

          <div
            className="absolute rounded-sm bg-white"
            style={{
              left: DINO_X,
              top: GROUND_Y - dinoY - DINO_SIZE,
              width: DINO_SIZE,
              height: DINO_SIZE,
            }}
          />

          <div
            className="absolute rounded-sm bg-amber-300"
            style={{ left: obstacleX, top: GROUND_Y - 22, width: OBSTACLE_WIDTH, height: 22 }}
          />

          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55">
              <p className="text-sm font-medium text-slate-100">Press space or click to {gameOver ? 'play again' : 'start'}</p>
            </div>
          )}
        </div>
      </div>

      <label className="mt-4 inline-flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={slowStart}
          onChange={(event) => setSlowStart(event.target.checked)}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-teal-400"
        />
        Start slower
      </label>
    </section>
  );
}

function useDatabaseStatus() {
  return useQuery({
    queryKey: ['about-database-status'],
    queryFn: async () => {
      if (!supabase) {
        return 'Local preview data';
      }

      const { count, error } = await supabase.from('projects').select('id', { count: 'exact', head: true });
      if (error) {
        return `Supabase connected, project count unavailable: ${error.message}`;
      }

      return `Supabase live database (${count ?? 0} projects)`;
    },
  });
}

export function AboutPage() {
  const { data: databaseStatus = 'Checking database...' } = useDatabaseStatus();
  const rows = [
    ['Product Name', productBrand.name],
    ['Description', productBrand.description],
    ['Default Service Partner', productBrand.partner],
    ['Current Client', productBrand.customer],
    ['Current Workspace', productBrand.workspace],
    ['Available Project Templates', projectTemplateOptions.map((template) => template.name).join(', ')],
    ['Version', productBrand.version],
    ['Database', databaseStatus],
    ['License Status', productBrand.licenseStatus],
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.32em] text-teal-200/80">About</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">{productBrand.name}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          {productBrand.description} for client workspaces, project templates, controlled users, supplier coordination, project journals, files, and reporting.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
              <p className="mt-2 text-sm font-medium text-white">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <OfflineRunnerGame />
    </div>
  );
}