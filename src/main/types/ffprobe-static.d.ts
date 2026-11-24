// ffprobe-static は型定義を同梱していないため最小限の宣言を置く
declare module 'ffprobe-static' {
  const ffprobeStatic: { path: string }
  export default ffprobeStatic
}
