// Source-space coordinates stay stable across desktop, tablet and landscape.
// Bounds ignore alpha noise below 8/255; the original PNG masters are retained.
export const SCENE_ACTORS=Object.freeze({
 hunter:Object.freeze({
  side:'left',src:'./assets/scene-v70/hunter.webp',width:1024,height:1536,
  bounds:[5,15,940,1465],origin:[520,1465],feet:[[295,1460,165],[790,1420,290]],
 }),
 outlaw:Object.freeze({
  side:'right',src:'./assets/scene-v70/outlaw.webp',width:1024,height:1536,
  bounds:[93,22,1022,1498],origin:[540,1498],feet:[[295,1434,280],[750,1492,160]],
 }),
});
