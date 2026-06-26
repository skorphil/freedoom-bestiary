import { useEffect, useRef } from "react";
import type { RenderTask } from "../models/Spritesheet.ts";

const DOOM_TICK_MS = 1000 / 35;

/**
 * Hook that runs a generator at 35Hz and calls onTick with the result.
 * Uses requestAnimationFrame with an accumulator for precise timing.
 */
export function useAnimationLoop(
  generator: Generator<RenderTask> | undefined,
  onTick: (task: RenderTask) => void
) {
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const requestRef = useRef<number>(undefined);
  const generatorRef = useRef(generator);

  // Keep generator ref up to date
  useEffect(() => {
    generatorRef.current = generator;
  }, [generator]);

  useEffect(() => {
    if (!generator) return;

    // Reset timing for new generator
    lastTimeRef.current = 0;
    accumulatorRef.current = 0;

    const loop = (now: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = now;
      }

      const deltaTime = now - lastTimeRef.current;
      lastTimeRef.current = now;
      accumulatorRef.current += deltaTime;

      let ticked = false;
      let lastTask: RenderTask | undefined;

      // Advance generator for each 1/35s that has passed
      while (accumulatorRef.current >= DOOM_TICK_MS) {
        if (!generatorRef.current) break;
        const result = generatorRef.current.next();
        if (result && !result.done) {
          lastTask = result.value;
          ticked = true;
        }
        accumulatorRef.current -= DOOM_TICK_MS;
      }

      if (ticked && lastTask) {
        onTick(lastTask);
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [generator, onTick]);
}
