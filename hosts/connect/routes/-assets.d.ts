// Asset imports resolve through Connect's Vite: images to URLs, `?raw` to text.
declare module "*.svg?raw" {
  const text: string;
  export default text;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.webp" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
