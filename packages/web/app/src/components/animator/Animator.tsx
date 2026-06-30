import styles from './Animator.module.css'

import { useRef } from "react";
import type { SpritesheetVersion, SpriteMeta } from "../../models/schema.ts";
import { useAnimation } from "./useAnimation.ts";

export type AnimatorProps = {
  code: string;
  version: SpritesheetVersion;
  meta: SpriteMeta;
  initialAnimation?: string;
  authorName?: string;
};

export function Animator({ 
  code,
  version, 
  meta, 
  initialAnimation = "idling",
  authorName
}: AnimatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    animName,
    setAnimName,
    angle,
    setAngle,
    image,
    error,
    animations,
    currentAngles,
    stageSize,
  } = useAnimation({
    code,
    version,
    meta,
    initialAnimation,
    canvasRef,
  });

  const handleAngleChange = (delta: number) => {
    const currentIndex = currentAngles.indexOf(angle);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + delta + currentAngles.length) % currentAngles.length;
    setAngle(currentAngles[nextIndex]);
  };

  return (
    <div className={styles.animator} style={{ position: 'relative' }}>
      <div className={styles.animatorDisplay}>
        {!image && !error && <div className={styles.loadingOverlay}>Loading...</div>}
        {error && <div className={styles.errorOverlay}>{error}</div>}
        
        <div className={styles.canvasWrapper} style={{ 
          aspectRatio: `${stageSize.width} / ${stageSize.height}`,
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%'
        }}>
          <canvas 
            ref={canvasRef} 
            className={styles.animatorCanvas}
            width={stageSize.width} 
            height={stageSize.height}
          />
        </div>
      </div>
      <div className={styles.animatorControls}>
        <div className={styles.angleControl}>
          <button 
            className={styles.angleButton} 
            onClick={() => handleAngleChange(-1)}
            title="Rotate Left"
          >
            <svg width="16" height="26" viewBox="0 0 16 26">
              <path d="M14 2L4 13L14 24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="square"/>
            </svg>
          </button>
          
          <div className={styles.stateControl}>
            <select 
              className={styles.stateSelect}
              value={animName} 
              onChange={(e) => setAnimName(e.target.value)}
            >
              {animations.map((anim) => (
                <option key={anim} value={anim}>{anim}</option>
              ))}
            </select>
          </div>

          <button 
            className={styles.angleButton} 
            onClick={() => handleAngleChange(1)}
            title="Rotate Right"
          >
            <svg width="16" height="26" viewBox="0 0 16 26">
              <path d="M2 2L12 13L2 24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="square"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
