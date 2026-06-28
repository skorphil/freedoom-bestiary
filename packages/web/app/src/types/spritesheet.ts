export interface Sprite {
  frame: string;
  angle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  author: string;
  state: string;
  url: string;
}

export interface SpritesheetVersion {
  date: string;
  sha: string;
  author: string;
  commitMessage: string;
  commitUrl: string;
  spritesheetPath: string;
  source: string;
  sprites: Sprite[];
}

export type SpritesheetsData = Record<string, SpritesheetVersion[]>;
