import { discoveryIcon } from '../game/pixel/items';
import { minerPortrait } from '../game/render/actors';
import type { DiscoveryItem } from '../game/discoveries/discoveries';

const urls = new Map<string, string>();

/** Data URL of a discovery's pixel icon, for use in <img> with `image-rendering: pixelated`. */
export function discoveryIconUrl(item: DiscoveryItem): string {
  const hit = urls.get(item.id);
  if (hit) return hit;
  const url = discoveryIcon(item).toDataURL();
  urls.set(item.id, url);
  return url;
}

let minerUrl: string | null = null;
export function minerPortraitUrl(): string {
  if (!minerUrl) minerUrl = minerPortrait(1).toDataURL();
  return minerUrl;
}
