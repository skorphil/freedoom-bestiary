import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpriteMeta, SpritesheetVersion } from "../../models/schema.ts";
import { type RenderTask, Spritesheet } from "../../models/Spritesheet.ts";
import { useAnimationLoop } from "./useAnimationLoop.ts";

export type UseAnimationOptions = {
  code: string;
  version: SpritesheetVersion;
  meta: SpriteMeta;
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
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize Spritesheet instance
  const spritesheet = useMemo(() => {
    if (!image) return null;
    return new Spritesheet(code, image, version, meta);
  }, [code, image, version, meta]);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      setImage(img);
      setError(null);
    };

    img.onerror = () => {
      setError(`Failed to load spritesheet for ${code}`);
    };

    img.src = `${import.meta.env.BASE_URL}${version.spritesheetPath}`.replace(
      "//",
      "/",
    );
  }, [version.spritesheetPath, code]);

  const animationsWithAngles = useMemo(() => {
    return spritesheet?.getAnimationsWithAngles() ?? [];
  }, [spritesheet]);

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
    if (!spritesheet || !animations.includes(animName)) return undefined;
    try {
      return spritesheet.play(animName, angle);
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }, [spritesheet, animName, angle, animations]);

  // The rendering callback
  const onTick = useCallback((task: RenderTask) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Set canvas dimensions to the stage size if they don't match
    if (
      canvas.width !== task.stageSize.width ||
      canvas.height !== task.stageSize.height
    ) {
      canvas.width = task.stageSize.width;
      canvas.height = task.stageSize.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (task.image.complete) {
      ctx.drawImage(
        task.image,
        task.source.x,
        task.source.y,
        task.source.width,
        task.source.height,
        task.offset.dx,
        task.offset.dy,
        task.source.width,
        task.source.height,
      );
    }
  }, [canvasRef]);

  // Run the heartbeat
  useAnimationLoop(generator, onTick);

  const stageSize = useMemo(
    () => spritesheet?.getStageSize() || { width: 64, height: 64 },
    [spritesheet],
  );

  return {
    animName,
    setAnimName,
    angle,
    setAngle,
    image,
    error,
    animations,
    currentAngles,
    stageSize,
  };
}
