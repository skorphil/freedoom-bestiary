import styles from './Animator.module.css'

import { useRef } from "react";
import type { SpritesheetVersion, SpriteMeta } from "../../models/schema.ts";
import { useAnimation } from "./useAnimation.ts";

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

  return (
    <div className={styles.animator}>
      <div className={styles.animatorDisplay}>
        {!image && !error && <div className={styles.loadingOverlay}>Loading...</div>}
        {error && <div className={styles.errorOverlay}>{error}</div>}
        
        <div className={styles.canvasWrapper} style={{ 
          aspectRatio: `${stageSize.width} / ${stageSize.height * 1.2}`,
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
        <div className={styles.controlGroup}>
          <label>State:</label>
          <select value={animName} onChange={(e) => setAnimName(e.target.value)}>
            {animations.map((anim) => (
              <option key={anim} value={anim}>{anim}</option>
            ))}
          </select>
        </div>
        <div className={styles.controlGroup}>
          <label>View Angle:</label>
          <div className={styles.angleButtons}>
            {currentAngles.map((a) => (
              <button 
                key={a} 
                className={`${styles.angleButton} ${angle === a ? styles.active : ''}`}
                onClick={() => setAngle(a)}
                title={`Angle ${a}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
