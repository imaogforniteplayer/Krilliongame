import { Panel } from '../components/Panel';

interface Item {
  name: string;
  note: string;
  needs: string;
}

const ITEMS: Item[] = [
  { name: 'Global, daily, weekly and friends leaderboards', note: 'Ranked results from real players.', needs: 'Online backend' },
  { name: 'Verified Friend Challenges', note: 'Codes and result swapping already work offline; server-checked results need the backend.', needs: 'Online backend' },
  { name: 'Live Dig Duel', note: 'Two miners digging side by side in real time.', needs: 'Realtime backend' },
  { name: 'Squad Expedition', note: 'Up to four players share a digging target.', needs: 'Realtime backend' },
  { name: 'Global Community Excavation', note: 'One worldwide shaft built from real players\' answers.', needs: 'Online backend' },
  { name: 'Real-player rarity', note: 'Rarity blended with what players actually answer, with smoothing.', needs: 'Online backend' },
  { name: 'Automatic background sync', note: 'Sign-in and manual cloud backup already exist (see Account). Syncing on its own, and scores that count for rankings, need the server rules.', needs: 'Online backend' },
  { name: 'Seasonal events and limited-time biomes', note: 'Event content is not built yet.', needs: 'Content' },
  { name: 'Weekly and monthly leaderboards, friends and rivals', note: 'Need real player accounts.', needs: 'Online backend' },
];

export function Soon() {
  return (
    <div className="page">
      <h1 className="title">Online features</h1>
      <p className="muted">
        DEEPER runs fully offline in demo mode. These features need a server, so they are not wired up and nothing here pretends to work.
      </p>
      <Panel>
        <ul className="soon">
          {ITEMS.map((i) => (
            <li key={i.name}>
              <div>
                <strong>{i.name}</strong>
                <span>{i.note}</span>
              </div>
              <em className="chip">{i.needs}</em>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
