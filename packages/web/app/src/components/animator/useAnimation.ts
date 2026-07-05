import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Character, Spritesheet, CharacterCode } from "@freedoom-bestiary/database";
import { type RenderTask, Spritesheet as LocalSpritesheet } from "../../models/Spritesheet.ts";
import { useAnimationLoop } from "./useAnimationLoop.ts";

export type UseAnimationOptions = {
  code: CharacterCode;
  version: Spritesheet;
  meta: Character;
  initialAnimation?: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
};

export function useAnimation({
  code,
  version,
  meta,
  initialAnimation = "idling",
  canvasRef,
}: UseAnimationOptions) {
  const [animName, setAnimName] = useState(initialAnimation);
  const [angle, setAngle] = useState(1);
  
  const [error, setError] = useState<string | null>(null);

  // Initialize Spritesheet instance
  const spritesheet = useMemo(() => {
    return new LocalSpritesheet(code, version, meta);
  }, [code, version, meta]);

  // Wait for image to load
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    let cancelled = false;
    
    spritesheet.ready().then(() => {
      if (!cancelled) {
        setIsReady(true);
        setError(null);
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(`Failed to load spritesheet for ${code}: ${err.message}`);
      }
    });
    
    return () => {
      cancelled = true;
    };
  }, [spritesheet, code]);

  const animationsWithAngles = useMemo(() => {
    return isReady ? spritesheet.getAnimationsWithAngles() : [];
  }, [spritesheet, isReady]);

  const animations = useMemo(() => {
    return animationsWithAngles.map((a) => a.name);
  }, [animationsWithAngles]);

  const currentAngles = useMemo(() => {
    return animationsWithAngles.find((a) => a.name === animName)?.angles ?? [1];
  }, [animationsWithAngles, animName]);

  // Ensure animName is valid for the current spritesheet
  useEffect(() => {
    if (animations.length > 0 && !animations.includes(animName)) {
      setAnimName(animations[0]);
    }
  }, [animations, animName]);

  // Ensure angle is valid for the current animation
  useEffect(() => {
    if (currentAngles.length > 0 && !currentAngles.includes(angle)) {
      // Try to stay on the same angle if possible, otherwise pick the first available
      setAngle(currentAngles[0]);
    }
  }, [currentAngles, angle]);

  // The generator for the current animation state
  const generator = useMemo(() => {
    if (!isReady) return undefined;
    // Check if the current animName is valid, otherwise use the first available
    const activeAnim = animations.includes(animName) ? animName : animations[0];
    if (!activeAnim) return undefined;
    
    try {
      return spritesheet.play(activeAnim, angle);
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }, [spritesheet, animName, angle, animations, isReady]);

  // The rendering callback
  const onTick = useCallback((task: RenderTask) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const scaledWidth = task.stageSize.width;
    const scaledHeight = task.stageSize.height * 1.2;

    // Set canvas dimensions to the scaled stage size if they don't match
    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (task.image.complete) {
      ctx.drawImage(
        task.image,
        task.source.x,
        task.source.y,
        task.source.width,
        task.source.height,
        task.offset.dx,
        task.offset.dy * 1.2,
        task.source.width,
        task.source.height * 1.2,
      );
    }
  }, [canvasRef]);

  // Run the heartbeat
  useAnimationLoop(generator, onTick);

  const stageSize = useMemo(
    () => isReady ? spritesheet.getStageSize() : { width: 64, height: 64 },
    [spritesheet, isReady],
  );

  return {
    animName,
    setAnimName,
    angle,
    setAngle,
    isReady,
    error,
    animations,
    currentAngles,
    stageSize,
  };
}
