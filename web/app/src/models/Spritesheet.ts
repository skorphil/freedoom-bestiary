import type { SpritesheetVersion, SpriteMeta, Sprite } from "./schema.ts";

export type RenderTask = {
  image: HTMLImageElement;
  source: Sprite;
  offset: { dx: number; dy: number };
  stageSize: { width: number; height: number };
};

/** Create instance of spritesheet, which provide handy methods */
export class Spritesheet {
  private maxWidth: number = 0;
  private maxHeight: number = 0;

  constructor(
    private code: string,
    private image: HTMLImageElement,
    private atlas: SpritesheetVersion,
    private meta: SpriteMeta
  ) {
    this.calculateBoundingBox();
  }

  private calculateBoundingBox() {
    this.maxWidth = Math.max(...this.atlas.sprites.map((s) => s.width), 0);
    this.maxHeight = Math.max(...this.atlas.sprites.map((s) => s.height), 0);
  }

  /** Return bounding box of all frames to avoid jumping */
  getStageSize() {
    return { width: this.maxWidth, height: Math.ceil(this.maxHeight * 1.2) };
  }

  /** return list of existing animations keys */
  private getAvailableAnimationKeys(): string[] {
    const keys: (keyof SpriteMeta)[] = ["idling", "chasing", "attacking", "hurting", "dying", "gibbing"];
    return keys.filter((key) => Array.isArray(this.meta[key]));
  }

  /** return list of existing animations with available angles */
  getAnimationsWithAngles(): { name: string; angles: number[] }[] {
    const availableAnims = this.getAvailableAnimationKeys();
    const sprites = this.atlas.sprites;

    return availableAnims.map((animName) => {
      const sequence = this.meta[animName as keyof SpriteMeta];
      if (!sequence || !Array.isArray(sequence)) return { name: animName, angles: [] };

      // Collect all frame letters used in this animation
      const framesInAnim = new Set(sequence.map((step) => step.frame));

      // Find all unique angles available for these frame letters in the atlas
      const angles = new Set<number>();
      sprites.forEach((s) => {
        if (framesInAnim.has(s.frame)) {
          const angleVal = parseInt(s.angle, 10);
          if (!isNaN(angleVal)) {
            angles.add(angleVal);
          }
        }
      });

      return {
        name: animName,
        angles: Array.from(angles).sort((a, b) => a - b),
      };
    });
  }

  /** 
   * Infinite generator yielding frame drawing tasks at 35Hz.
   * Handles delays and looping internally.
   */
  *play(animName: string, angle: number): Generator<RenderTask> {
    const sequence = this.meta[animName as keyof SpriteMeta];
    if (!sequence || !Array.isArray(sequence)) {
      const available = this.getAnimationsWithAngles().map(a => a.name).join(", ");
      throw new Error(`Animation "${animName}" does not exist for ${this.code}. Available: ${available}`);
    }

    while (true) {
      for (const step of sequence) {
        const sprite = this.findSprite(step.frame, angle);
        const delay = step.delay <= 0 ? 1 : step.delay;

        const renderTask: RenderTask = {
          image: this.image,
          source: sprite,
          offset: {
            dx: Math.round((this.maxWidth - sprite.width) / 2),
            dy: Math.round(this.maxHeight * 1.2 - sprite.height * 1.2),
          },
          stageSize: this.getStageSize(),
        };

        for (let i = 0; i < delay; i++) {
          yield renderTask;
        }
      }
    }
  }

  private findSprite(frame: string, angle: number): Sprite {
    const sprites = this.atlas.sprites;
    const angleStr = angle.toString();

    // 1. Try exact match
    let found = sprites.find((s) => s.frame === frame && s.angle === angleStr);
    if (found) return found;

    // 2. Try angle 0 (rotation-less)
    found = sprites.find((s) => s.frame === frame && s.angle === "0");
    if (found) return found;

    // 3. Try any angle for this frame
    found = sprites.find((s) => s.frame === frame);
    if (found) return found;

    // 4. Fallback to any sprite at all (should not happen with valid data)
    return sprites[0];
  }
}
