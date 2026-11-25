import {
  CanvasTexture,
  CircleGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial,
  type Object3D,
} from 'three';
import type { Enemy } from './types';

export function perceptionView(enemy: Enemy, root: Object3D, height: number) {
  const p = enemy.perception!;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, toneMapped: false });
  const marker = new Sprite(material);
  marker.position.y = height;
  marker.scale.setScalar(0.5);
  const radians = (p.angle * Math.PI) / 180;
  const geometry = new CircleGeometry(
    p.range,
    32,
    Math.PI * 1.5 - radians / 2,
    radians,
  );
  const tint = new MeshBasicMaterial({
    color: 0xefa934,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: DoubleSide,
  });
  const cone = new Mesh(geometry, tint);
  cone.rotation.x = -Math.PI / 2;
  // Płaskie nakładki bez konturu cel-shadingu (inaczej kwadratowa ramka wokół sprite'a).
  marker.userData.noOutline = true;
  cone.userData.noOutline = true;
  root.add(marker, cone);
  let previous = '';
  return {
    render() {
      const alive = enemy.current.state !== 'dead';
      cone.visible = alive && p.showCone;
      cone.position.y = 0.035 - (p.spawn.sentry ? enemy.current.position.y : 0);
      cone.rotation.z = enemy.current.yaw - root.rotation.y;
      marker.visible =
        alive && (p.state === 'suspicious' || p.state === 'alerted');
      const fill = Math.round(80 * p.awareness);
      const key = p.state + fill;
      if (!marker.visible || key === previous) return;
      previous = key;
      ctx.clearRect(0, 0, 96, 96);
      const accent = p.state === 'alerted' ? '#ff3535' : '#ffbb44';
      ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
      ctx.beginPath();
      ctx.arc(48, 48, 40, 0, 2 * Math.PI);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.font = 'bold 66px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.state === 'alerted' ? '!' : '?', 48, 68);
      if (p.state === 'suspicious') ctx.fillRect(8, 75, fill, 5);
      texture.needsUpdate = true;
    },
    dispose() {
      marker.removeFromParent();
      cone.removeFromParent();
      texture.dispose();
      material.dispose();
      geometry.dispose();
      tint.dispose();
    },
  };
}
