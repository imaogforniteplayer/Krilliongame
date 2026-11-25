import { spriteFromRows } from '../game/pixel/canvas';
import { discoveryIcon } from '../game/pixel/items';
import { petSprite } from '../game/render/pets';
import { lookSignature, minerPortrait } from '../game/render/actors';
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

let minerUrl: { sig: string; url: string } | null = null;
/** Data URL of the miner in their current outfit. Re-rendered whenever the look changes. */
export function minerPortraitUrl(): string {
  const sig = lookSignature();
  if (!minerUrl || minerUrl.sig !== sig) minerUrl = { sig, url: minerPortrait(1).toDataURL() };
  return minerUrl.url;
}

const HEART = ['.oo.oo.', 'oRRoRRo', 'oRRRRRo', '.oRRRo.', '..oRo..', '...o...'];
const hearts = new Map<boolean, string>();
/** Pixel-art heart for Survival Dig lives. */
export function heartUrl(full: boolean): string {
  let url = hearts.get(full);
  if (!url) {
    url = spriteFromRows(full ? 'heart' : 'heart-empty', HEART, { o: '#1b1226', R: full ? '#ff4d5e' : '#3a3050' }).toDataURL();
    hearts.set(full, url);
  }
  return url;
}

const petUrls = new Map<string, string>();
/** Icon of a pet, or null for "no pet". */
export function petIconUrl(id: string): string | null {
  const hit = petUrls.get(id);
  if (hit) return hit;
  const sprite = petSprite(id);
  if (!sprite) return null;
  const url = sprite.toDataURL();
  petUrls.set(id, url);
  return url;
}
