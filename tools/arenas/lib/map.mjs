import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { corners } from './geometry.mjs';

const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
const n = (value) => Number(value.toFixed(2));

export function arenaSvg(input, metadata = input.metadata ?? {}) {
  const room = typeof input.toRoom === 'function' ? input.toRoom() : input;
  const all = room.blocks.flatMap((b) => corners(b));
  const bounds = metadata.bounds ?? {
    minX: Math.min(...all.map((p) => p.x)),
    maxX: Math.max(...all.map((p) => p.x)),
    minZ: Math.min(...all.map((p) => p.z)),
    maxZ: Math.max(...all.map((p) => p.z)),
  };
  const margin = 18,
    width = bounds.maxX - bounds.minX,
    depth = bounds.maxZ - bounds.minZ;
  const x = (p) => n(p.x - bounds.minX + margin),
    z = (p) => n(p.z - bounds.minZ + margin);
  const tops = room.blocks.map((b) =>
    Math.max(...corners(b, true).map((p) => p.y)),
  );
  const minH = Math.min(...tops),
    maxH = Math.max(...tops);
  const color = (h) =>
    `hsl(${n(215 - (175 * (h - minH)) / Math.max(1, maxH - minH))} 35% ${n(24 + (30 * (h - minH)) / Math.max(1, maxH - minH))}%)`;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + 2 * margin} ${depth + 2 * margin + 24}" width="1200" role="img" aria-labelledby="title desc">`,
    `<title id="title">${escape(room.name)} — rzut z góry</title>`,
    '<desc id="desc">Wysokość brył: granat (nisko) do bursztynu (wysoko). Zielony obrys: powierzchnie chodzenia. Przerywane: niewidoczna kolizja. Okręgi: punkty. Krzyżyki: spawny. Trójkąt: gracz. Północ: −Z.</desc>',
    '<rect width="100%" height="100%" fill="#101820"/>',
    `<g font-family="sans-serif" font-size="2.8" fill="#fff1d6">`,
    `<text x="${margin}" y="7" font-size="4">${escape(room.name)} · ${width} × ${depth} m · N ↑ (−Z)</text>`,
  ];
  parts.push('<g id="blocks">');
  room.blocks
    .map((b, i) => ({ b, h: tops[i] }))
    .sort((a, b) => a.h - b.h)
    .forEach(({ b, h }) => {
      const face = corners(b, true),
        ordered = [face[0], face[2], face[3], face[1]];
      parts.push(
        `<polygon points="${ordered.map((p) => `${x(p)},${z(p)}`).join(' ')}" fill="${b.visible === false ? 'none' : color(h)}" stroke="${b.visible === false ? '#d8bd87' : b.walkable ? '#90be85' : '#50606e'}" stroke-width="${b.walkable ? 0.3 : 0.15}"${b.visible === false ? ' stroke-dasharray="1 1"' : ''}><title>${escape(b.model ?? b.material ?? 'blok')}; wierzch ${n(h)} m${b.walkable ? '; chodzenie' : ''}</title></polygon>`,
      );
    });
  parts.push(
    '</g><g id="grid" stroke="#c2d1da" stroke-opacity="0.15" stroke-width="0.15">',
  );
  for (let gx = Math.ceil(bounds.minX / 10) * 10; gx <= bounds.maxX; gx += 10)
    parts.push(`<path d="M${x({ x: gx })} ${margin}v${depth}"/>`);
  for (let gz = Math.ceil(bounds.minZ / 10) * 10; gz <= bounds.maxZ; gz += 10)
    parts.push(`<path d="M${margin} ${z({ z: gz })}h${width}"/>`);
  parts.push('</g><g id="zones">');
  (metadata.zones ?? []).forEach(({ name, rect, kind }, i) => {
    const colors = ['#ffbd57', '#a8c984', '#baa1d8', '#8caee8', '#c7ba98'];
    parts.push(
      `<rect x="${x({ x: rect.minX })}" y="${z({ z: rect.minZ })}" width="${n(rect.maxX - rect.minX)}" height="${n(rect.maxZ - rect.minZ)}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="0.5" stroke-dasharray="2 1"/><text x="${x({ x: rect.minX }) + 1}" y="${z({ z: rect.minZ }) + 4}" fill="${colors[i % colors.length]}" stroke="#101820" stroke-width="0.5" paint-order="stroke">${escape(name)} (${escape(kind)})</text>`,
    );
  });
  parts.push('</g><g id="props" fill="#d6c8ad" fill-opacity="0.7">');
  (room.decor ?? []).forEach((d) =>
    parts.push(
      `<circle cx="${x(d.position)}" cy="${z(d.position)}" r="0.5"><title>${escape(d.model)}</title></circle>`,
    ),
  );
  parts.push('</g><g id="spawns" stroke="#e6d6b0" stroke-width="0.45">');
  (room.arena?.spawnPoints ?? room.spawnPoints).forEach((p, i) =>
    parts.push(
      `<path d="M${x(p) - 1} ${z(p) - 1}l2 2m-2 0l2 -2"><title>Spawn ${i + 1}</title></path>`,
    ),
  );
  parts.push('</g><g id="points">');
  (room.arena?.points ?? []).forEach((p) =>
    parts.push(
      `<circle cx="${x(p.position)}" cy="${z(p.position)}" r="${p.radiusM}" fill="#fff1d6" fill-opacity="0.18" stroke="#fff1d6" stroke-width="0.6"/><text x="${x(p.position)}" y="${z(p.position) + 1.5}" text-anchor="middle" font-size="5">${escape(p.id)}<title>y = ${p.position.y} m</title></text>`,
    ),
  );
  const start = room.playerSpawn;
  parts.push(
    `</g><g id="player" fill="#a4e5bc"><path d="M${x(start)} ${z(start) - 2}l-1.8 4h3.6Z"/><text x="${x(start) + 3}" y="${z(start) + 1}">START</text></g>`,
  );
  const baseline = depth + margin + 9;
  parts.push(
    `<path d="M${margin} ${baseline - 2}v4m0 -2h50m0 -2v4" fill="none" stroke="#fff1d6" stroke-width="0.5"/><text x="${margin + 25}" y="${baseline + 6}" text-anchor="middle">50 m · siatka 10 m</text>`,
    `<text x="${margin + 60}" y="${baseline}">Wierzch: ${n(minH)}…${n(maxH)} m · zielony obrys: chodzenie</text>`,
    `<text x="${margin + 60}" y="${baseline + 5}">Linia przerywana: zabezpieczenie · × spawn · △ gracz</text>`,
    '</g></svg>',
  );
  return parts.join('\n') + '\n';
}

export function writeArenaSvg(path, input, metadata) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, arenaSvg(input, metadata), 'utf8');
}
