import { Panel } from '../components/Panel';

interface Item {
  name: string;
  note: string;
  needs: string;
}

const ITEMS: Item[] = [
  { name: 'Global, daily, weekly and friends leaderboards', note: 'Ranked results from real players.', needs: 'Online backend' },
  { name: 'Friend Challenge', note: 'Invite by link or room code; both players get the same questions.', needs: 'Online backend' },
  { name: 'Live Dig Duel', note: 'Two miners digging side by side in real time.', needs: 'Realtime backend' },
  { name: 'Squad Expedition', note: 'Up to four players share a digging target.', needs: 'Realtime backend' },
  { name: 'Global Community Excavation', note: 'One worldwide shaft built from real players\' answers.', needs: 'Online backend' },
  { name: 'Real-player rarity', note: 'Rarity blended with what players actually answer, with smoothing.', needs: 'Online backend' },
  { name: 'Accounts and cross-device sync', note: 'Optional sign-in. Guest play always stays open.', needs: 'Online backend' },
  { name: 'Customisation, pets and personal base', note: 'Cosmetics only. Nothing paid ever affects digging.', needs: 'More art and design' },
  { name: 'Seasonal events and extra question packs', note: 'The pack system exists; more packs and events are content work.', needs: 'Content' },
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
