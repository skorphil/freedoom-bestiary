import type {
	AnimationName,
	AnimationStep,
	Character,
	CharacterCode,
	Sprite,
	Spritesheet as SpritesheetData,
} from "@freedoom-bestiary/database/schema";

export type RenderTask = {
	image: HTMLImageElement;
	source: Sprite;
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
		private atlas: SpritesheetData,
		private getMeta: () => Character | undefined,
	) {
		this.calculateBoundingBox();
		this.imageLoaded = this.loadImage();
	}

	get id(): string {
		return this.atlas.spritesheetId;
	}

	get data(): SpritesheetData {
		return this.atlas;
	}

	private async loadImage(): Promise<void> {
		if (typeof Image === "undefined") {
			return Promise.resolve();
		}
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = "anonymous";
			img.onload = () => {
				this.image = img;
				resolve();
			};
			img.onerror = () => {
				reject(new Error(`Failed to load spritesheet image: ${img.src}`));
			};

			const baseUrl = import.meta.env.BASE_URL.endsWith("/")
				? import.meta.env.BASE_URL
				: `${import.meta.env.BASE_URL}/`;

			img.src = `${baseUrl}spritesheets/${this.atlas.fileName}`;
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

	/** Gets character metadata for this spritesheet. Throws if not found. */
	private get characterMeta(): Character {
		const meta = this.getMeta();
		if (!meta) {
			throw new Error(`Character metadata not found for code: ${this._code}`);
		}
		return meta;
	}

	/**
	 * Returns a localized date string.
	 * @warning This method uses the system locale and will cause hydration mismatches
	 * if rendered on the server. Use within a useEffect or a hydration guard.
	 */
	getDate(): string {
		const date = new Date(this.atlas.commitDate);
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}

	getCharacterName(): string {
		return this.characterMeta.freedoomName;
	}

	getCharacterDescription(): string {
		return this.characterMeta.description;
	}

	getStageSize() {
		return { width: this.maxWidth, height: Math.ceil(this.maxHeight * 1.2) };
	}

	private getAvailableAnimationKeys(meta: Character): string[] {
		const keys = Object.keys(meta.animations);
		return keys.filter((key) =>
			Array.isArray(meta.animations[key as keyof Character["animations"]]),
		);
	}

	getAnimations(): Partial<
		Record<AnimationName, { steps: AnimationStep[]; angles: number[] }>
	> {
		const meta = this.characterMeta;
		const availableAnims = this.getAvailableAnimationKeys(
			meta,
		) as AnimationName[];
		const sprites = this.atlas.sprites;
		const result: Partial<
			Record<AnimationName, { steps: AnimationStep[]; angles: number[] }>
		> = {};

		for (const animName of availableAnims) {
			const sequence = meta.animations[animName];
			if (!sequence || !Array.isArray(sequence)) continue;

			const framesInAnim = new Set(sequence.map((step) => step.frame));
			const angles = new Set<number>();

			framesInAnim.forEach((frame) => {
				const frameSprites = sprites.filter((s) => s.frame === frame);
				const hasAngleZero = frameSprites.some((s) => s.angle === 0);

				if (hasAngleZero) {
					angles.add(0);
				} else {
					frameSprites.forEach((s) => {
						if (!isNaN(s.angle)) {
							angles.add(s.angle);
						}
					});
				}
			});

			if (angles.size > 0) {
				result[animName] = {
					steps: sequence,
					angles: Array.from(angles).sort((a, b) => a - b),
				};
			}
		}

		return result;
	}

	/** @deprecated Use getAnimations() instead */
	getAnimationsWithAngles(
		meta: Character,
	): { name: AnimationName; angles: number[] }[] {
		const anims = this.getAnimations();
		return Object.entries(anims).map(([name, data]) => ({
			name: name as AnimationName,
			angles: data!.angles,
		}));
	}

	*play(animName: AnimationName, angle: number): Generator<RenderTask> {
		const meta = this.characterMeta;
		const sequence = meta.animations[animName];
		if (!sequence || !Array.isArray(sequence)) {
			const available = Object.keys(this.getAnimations()).join(", ");
			throw new Error(
				`Animation "${animName}" does not exist for ${this.code}. Available: ${available}`,
			);
		}

		while (true) {
			for (const step of sequence) {
				const sprite = this.findSprite(step.frame, angle);
				const delay = step.delay <= 0 ? 1 : step.delay;

				if (!this.image && typeof Image !== "undefined") {
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
