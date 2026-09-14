import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { autoBackup } from './db/autobackup';
import { requestPersistentStorage, seedIfNeeded } from './db/seed';
import { App } from './ui/App';

async function start() {
  try {
    await seedIfNeeded();
  } catch (e) {
    console.error('Seeding failed', e);
  }
  try {
    // refresh the on-device backup copy, or bring data back from it if storage was wiped
    if ((await autoBackup()) === 'restored') await seedIfNeeded();
  } catch (e) {
    console.error('Auto-backup failed', e);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void autoBackup().catch(() => {});
  });
  void requestPersistentStorage();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
