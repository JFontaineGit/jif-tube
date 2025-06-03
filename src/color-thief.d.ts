declare module 'color-thief' {
  export default class ColorThief {
    getColor(img: HTMLImageElement | HTMLCanvasElement): [number, number, number];
    getPalette(img: HTMLImageElement | HTMLCanvasElement, colorCount?: number): [number, number, number][];
  }
}