import { BIOMES, biomeAtDepth } from '../../game/biomes/biomes';
import { formatMetres } from '../../game/scoring/scoring';
import { useSave } from '../store';

export function BiomeMap() {
  const { save } = useSave();
  const deepest = save.deepestEver;
  const current = biomeAtDepth(deepest);
  return (
    <div className="page">
      <h1 className="title">Biome Map</h1>
      <p className="muted">
        Fifteen layers, from sunlit grass to the thing at the bottom. Your deepest dig so far: {formatMetres(deepest)} in the {current.name}.
      </p>
      <ol className="biomes">
        {BIOMES.map((b, i) => {
          const next = BIOMES[i + 1];
          const reached = deepest >= b.startDepth;
          const here = current.id === b.id;
          return (
            <li
              key={b.id}
              className={`biome${reached ? '' : ' biome--locked'}${here ? ' biome--here' : ''}`}
              style={{ ['--base' as string]: b.palette.base, ['--accent' as string]: b.palette.accent, ['--dark' as string]: b.palette.dark }}
            >
              <span className="biome__swatch" aria-hidden="true" />
              <div className="biome__text">
                <strong>{reached ? b.name : '???'}</strong>
                <small>
                  {formatMetres(b.startDepth)}
                  {next ? ` to ${formatMetres(next.startDepth)}` : ' and below'}
                </small>
                <span>{reached ? b.blurb : 'Not reached yet.'}</span>
              </div>
              {here ? <em className="biome__tag">You are here</em> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
