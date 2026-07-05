import type { 
  Spritesheet as SpritesheetData, 
  Sprite, 
  Character,
  CharacterCode 
} from "@freedoom-bestiary/database";

export type RenderTask = {
  image: HTMLImageElement;
  source: Sprite;  // Database type
  offset: { dx: number; dy: number };
  stageSize: { width: number; height: number };
};

export class Spritesheet {
  private maxWidth: number = 0;
  private maxHeight: number = 0;
  private image: HTMLImageElement | null = null;
  private imageLoaded: Promise<void>;

  constructor(
    private _code: CharacterCode,
    private atlas: SpritesheetData,  // Database type
    private meta: Character          // Database type
  ) {
    this.calculateBoundingBox();
    this.imageLoaded = this.loadImage();
  }

  private async loadImage(): Promise<void> {
    if (typeof Image === 'undefined') {
      // In test environment (Bun), Image is not defined. 
      // We skip actual image loading but still resolve for testing logic.
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.image = img;
        resolve();
      };
      img.onerror = reject;
      // Use symlinked path from public/spritesheets
      img.src = `${import.meta.env.BASE_URL}spritesheets/${this.atlas.fileName}`;
    });
  }

  async ready(): Promise<void> {
    return this.imageLoaded;
  }

  private calculateBoundingBox() {
    this.maxWidth = Math.max(...this.atlas.sprites.map((s) => s.width), 0);
    this.maxHeight = Math.max(...this.atlas.sprites.map((s) => s.height), 0);
  }

  get code() { 
    return this._code;
  }

  getStageSize() {
    return { width: this.maxWidth, height: Math.ceil(this.maxHeight * 1.2) };
  }

  private getAvailableAnimationKeys(): string[] {
    const keys: (keyof Character["animations"])[] = [
      "idling", "chasing", "attacking", "hurting", "dying", "gibbing"
    ];
    return keys.filter((key) => Array.isArray(this.meta.animations[key]));
  }

  getAnimationsWithAngles(): { name: string; angles: number[] }[] {
    const availableAnims = this.getAvailableAnimationKeys();
    const sprites = this.atlas.sprites;

    return availableAnims.map((animName) => {
      const sequence = this.meta.animations[animName as keyof Character["animations"]];
      if (!sequence || !Array.isArray(sequence)) return { name: animName, angles: [] };

      const framesInAnim = new Set(sequence.map((step) => step.frame));
      const angles = new Set<number>();
      
      framesInAnim.forEach(frame => {
        const frameSprites = sprites.filter(s => s.frame === frame);
        const hasAngleZero = frameSprites.some(s => s.angle === 0);
        
        if (hasAngleZero) {
          angles.add(0);
        } else {
          frameSprites.forEach(s => {
            if (!isNaN(s.angle)) {
              angles.add(s.angle);
            }
          });
        }
      });

      return {
        name: animName,
        angles: Array.from(angles).sort((a, b) => a - b),
      };
    });
  }

  *play(animName: string, angle: number): Generator<RenderTask> {
    const sequence = this.meta.animations[animName as keyof Character["animations"]];
    if (!sequence || !Array.isArray(sequence)) {
      const available = this.getAnimationsWithAngles().map(a => a.name).join(", ");
      throw new Error(`Animation "${animName}" does not exist for ${this.code}. Available: ${available}`);
    }

    while (true) {
      for (const step of sequence) {
        const sprite = this.findSprite(step.frame, angle);
        const delay = step.delay <= 0 ? 1 : step.delay;

        if (!this.image && typeof Image !== 'undefined') {
          throw new Error("Image not loaded");
        }

        const renderTask: RenderTask = {
          image: this.image as HTMLImageElement,
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

    // 1. Try angle 0 (rotation-less)
    let found = sprites.find((s) => s.frame === frame && s.angle === 0);
    if (found) return found;

    // 2. Try exact match
    found = sprites.find((s) => s.frame === frame && s.angle === angle);
    if (found) return found;

    // 3. Try any angle for this frame
    found = sprites.find((s) => s.frame === frame);
    if (found) return found;

    // 4. Fallback
    return sprites[0];
  }
}