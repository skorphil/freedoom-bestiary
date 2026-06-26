import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { SpritesheetVersion, SpriteMeta } from "../../models/schema.ts";
import { Spritesheet, type RenderTask } from "../../models/Spritesheet.ts";
import { useAnimationLoop } from "../../hooks/useAnimationLoop.ts";

export type AnimatorProps = {
  code: string;
  version: SpritesheetVersion;
  meta: SpriteMeta;
  initialAnimation?: string;
};

export function Animator({ 
  code,
  version, 
  meta, 
  initialAnimation = "idling" 
}: AnimatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    img.src = `${import.meta.env.BASE_URL}${version.spritesheetPath}`.replace("//", "/");
  }, [version.spritesheetPath, code]);

  const animationsWithAngles = useMemo(() => {
    return spritesheet?.getAnimationsWithAngles() ?? [];
  }, [spritesheet]);

  const animations = useMemo(() => {
    return animationsWithAngles.map(a => a.name);
  }, [animationsWithAngles]);

  const currentAngles = useMemo(() => {
    return animationsWithAngles.find(a => a.name === animName)?.angles ?? [1];
  }, [animationsWithAngles, animName]);

  // Ensure animName is valid for the current spritesheet
  useEffect(() => {
    if (animations.length > 0 && !animations.includes(animName)) {
      setAnimName(animations[0]);
    }
  }, [animations]);

  // Ensure angle is valid for the current animation
  useEffect(() => {
    if (currentAngles.length > 0 && !currentAngles.includes(angle)) {
      // Try to stay on the same angle if possible, otherwise pick the first available
      setAngle(currentAngles[0]);
    }
  }, [currentAngles]);

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
    if (canvas.width !== task.stageSize.width || canvas.height !== task.stageSize.height) {
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
        task.source.height
      );
    }
  }, []);

  // Run the heartbeat
  useAnimationLoop(generator, onTick);

  const stageSize = useMemo(() => spritesheet?.getStageSize() || { width: 64, height: 64 }, [spritesheet]);

  return (
    <div className="animator">
      <div className="animator-display">
        {!image && !error && <div className="loading-overlay">Loading...</div>}
        {error && <div className="error-overlay">{error}</div>}
        
        <div className="canvas-wrapper">
          <canvas 
            ref={canvasRef} 
            className="animator-canvas" 
            width={stageSize.width} 
            height={stageSize.height}
          />
        </div>
      </div>
      
      <div className="animator-controls">
        <div className="control-group">
          <label>State:</label>
          <select value={animName} onChange={(e) => setAnimName(e.target.value)}>
            {animations.map((anim) => (
              <option key={anim} value={anim}>{anim}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label>View Angle:</label>
          <div className="angle-buttons">
            {currentAngles.map((a) => (
              <button 
                key={a} 
                className={`angle-button ${angle === a ? 'active' : ''}`}
                onClick={() => setAngle(a)}
                title={`Angle ${a}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .animator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid #333;
          border-radius: 8px;
          background: #1a1a1a;
          color: #eee;
          width: fit-content;
        }
        .animator-display {
          position: relative;
          background-image:
            linear-gradient(45deg, #222 25%, transparent 25%),
            linear-gradient(-45deg, #222 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #222 75%),
            linear-gradient(-45deg, transparent 75%, #222 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
          background-color: #111;
          padding: 2rem;
          border-radius: 4px;
          min-width: 160px;
          min-height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .canvas-wrapper {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          transform: scale(1, 1.2);
          transform-origin: bottom;
        }
        .animator-canvas {
          display: block;
          image-rendering: pixelated;
        }
        .loading-overlay, .error-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.5);
          z-index: 1;
        }
        .error-overlay {
          color: #ff4444;
          text-align: center;
          padding: 10px;
        }
        .animator-controls {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          font-size: 0.9rem;
          width: 100%;
        }
        .control-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: space-between;
        }
        .control-group select {
          background: #333;
          color: white;
          border: 1px solid #555;
          padding: 2px 4px;
        }
        .angle-buttons {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
        }
        .angle-button {
          background: #333;
          color: white;
          border: 1px solid #555;
          padding: 2px 6px;
          cursor: pointer;
          font-size: 0.8rem;
        }
        .angle-button:hover {
          background: #444;
        }
        .angle-button.active {
          background: #007bff;
          border-color: #0056b3;
        }
      `}</style>
    </div>
  );
}
