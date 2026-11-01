export const CAMERA_PRESETS = [
  ['home', '房间全景'], ['front', '人物正面'], ['face', '脸部特写'],
  ['portrait', '斜侧近景'], ['side', '人物侧面'], ['back', '人物背面'], ['top', '房间俯视'],
];
const CHARACTER_VIEWS = {
  front: { offset: [0, .85, 3.1], targetY: .72 },
  face: { offset: [0, 1.1, 1.4], targetY: 1.04 },
  portrait: { offset: [1.7, 1.5, 2.8], targetY: .76 },
  side: { offset: [2.8, .85, 0], targetY: .72 },
  back: { offset: [0, .85, -2.8], targetY: .72 },
};
export function cameraPose(preset, character) {
  if (preset === 'home') return { position: [7, 6.5, 9], target: [0, .6, 0] };
  if (preset === 'top') return { position: [0, 9.5, .01], target: [0, 0, 0] };
  const view = CHARACTER_VIEWS[preset];
  if (!view) throw new Error(`Unknown camera preset: ${preset}`);
  const [x, y, z] = view.offset;
  const c = Math.cos(character.yaw), s = Math.sin(character.yaw);
  return {
    position: [character.x + c * x + s * z, y, character.z - s * x + c * z],
    target: [character.x, view.targetY, character.z],
  };
}
export function cameraZoom(preset, aspect) {
  // Portrait views need less empty room around the character on narrow screens.
  return Math.min(1, aspect / (['home', 'top'].includes(preset) ? 1.2 : .75));
}
