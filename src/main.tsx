import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { requestPersistentStorage, seedIfNeeded } from './db/seed';
import { App } from './ui/App';

async function start() {
  try {
    await seedIfNeeded();
  } catch (e) {
    console.error('Seeding failed', e);
  }
  void requestPersistentStorage();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
