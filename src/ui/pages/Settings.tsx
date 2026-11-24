import { useState } from 'react';
import { audio } from '../../game/audio/audio';
import { defaultSave } from '../../game/storage';
import { Panel } from '../components/Panel';
import { useSave } from '../store';

export function Settings() {
  const { save, update } = useSave();
  const s = save.settings;
  const [confirm, setConfirm] = useState(false);
  const set = (patch: Partial<typeof s>) => update((cur) => ({ ...cur, settings: { ...cur.settings, ...patch } }));

  function exportSave() {
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deeper-save.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div className="page">
      <h1 className="title">Settings</h1>

      <Panel title="Sound">
        <label className="field">
          <span>Volume {Math.round(s.volume * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            onChange={(e) => set({ volume: Number(e.target.value) })}
            onPointerUp={() => audio.sfx('click')}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.musicOn} onChange={(e) => set({ musicOn: e.target.checked })} />
          Music
        </label>
        <label className="check">
          <input type="checkbox" checked={s.sfxOn} onChange={(e) => set({ sfxOn: e.target.checked })} />
          Sound effects
        </label>
      </Panel>

      <Panel title="Motion">
        <label className="field">
          <span>Reduced motion</span>
          <select
            value={s.reducedMotion === null ? 'system' : s.reducedMotion ? 'on' : 'off'}
            onChange={(e) => set({ reducedMotion: e.target.value === 'system' ? null : e.target.value === 'on' })}
          >
            <option value="system">Follow my device</option>
            <option value="on">On (shorter, calmer digs)</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.skipAnimations} onChange={(e) => set({ skipAnimations: e.target.checked })} />
          Skip dig animations (the miner still digs, just instantly)
        </label>
        <p className="muted">You can also tap "Skip animation" during any dig.</p>
      </Panel>

      <Panel title="Your data">
        <p className="muted">Everything lives in this browser. Export a backup, or start over.</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={exportSave}>
            Export save
          </button>
          {confirm ? (
            <>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  update(() => defaultSave());
                  setConfirm(false);
                }}
              >
                Yes, erase everything
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--danger" onClick={() => setConfirm(true)}>
              Reset progress
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
}
