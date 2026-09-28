// 静态资源模块声明：Metro 打包期将图片解析为资源 id（number）
declare module "*.png" {
  const value: number;
  export default value;
}
declare module "*.jpg" {
  const value: number;
  export default value;
}
declare module "*.webp" {
  const value: number;
  export default value;
}
