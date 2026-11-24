import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { DigRenderer } from '../../game/render/DigRenderer';
import type { RendererHooks } from '../../game/render/DigRenderer';

export interface DigCanvasHandle {
  renderer: () => DigRenderer | null;
}

interface Props {
  hooks?: RendererHooks;
  reducedMotion: boolean;
  /** Runs the idle showcase loop (landing page) instead of waiting for dig commands. */
  demo?: boolean;
  /** Logical (pre-scale) width in pixels; larger means a smaller, wider-looking scene. */
  logicalWidth?: number;
  className?: string;
  /** Called once the renderer exists, after its first resize. */
  onReady?: (r: DigRenderer) => void;
  onClick?: () => void;
}

/**
 * Hosts the pixel renderer. The hooks object may change between renders (it closes over React
 * state), so the renderer reads it through a ref instead of being re-created.
 */
export const DigCanvas = forwardRef<DigCanvasHandle, Props>(function DigCanvas(
  { hooks, reducedMotion, demo, logicalWidth, className, onReady, onClick },
  ref,
) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DigRenderer | null>(null);
  const hooksRef = useRef<RendererHooks | undefined>(hooks);
  const readyRef = useRef(onReady);
  hooksRef.current = hooks;
  readyRef.current = onReady;

  useImperativeHandle(ref, () => ({ renderer: () => rendererRef.current }), []);

  useEffect(() => {
    const el = canvas.current;
    const host = box.current;
    if (!el || !host) return;
    const proxy: RendererHooks = {
      onEquip: (t) => hooksRef.current?.onEquip?.(t),
      onImpact: (t, s) => hooksRef.current?.onImpact?.(t, s),
      onDiscovery: (i) => hooksRef.current?.onDiscovery?.(i),
      onBiomeChange: (b) => hooksRef.current?.onBiomeChange?.(b),
      onDigEnd: (t) => hooksRef.current?.onDigEnd?.(t),
      onFrame: (d) => hooksRef.current?.onFrame?.(d),
    };
    const r = new DigRenderer(el, proxy, reducedMotion);
    rendererRef.current = r;
    const fit = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) r.resize(rect.width, rect.height, logicalWidth ?? (rect.width < 520 ? 150 : 220));
    };
    fit();
    r.start();
    readyRef.current?.(r);
    if (demo) r.startDemo();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => {
      ro.disconnect();
      r.destroy();
      rendererRef.current = null;
    };
    // The renderer is created once per mount; reduced-motion changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return (
    <div ref={box} className={className ?? 'dig-canvas'} onClick={onClick}>
      <canvas ref={canvas} aria-label="Animated underground scene" role="img" />
    </div>
  );
});
