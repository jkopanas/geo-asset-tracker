import { readFileSync } from 'fs';
import app, { store } from './app.js';

const seedUrl = new URL('../../seed.json', import.meta.url);
const seedData = JSON.parse(readFileSync(seedUrl, 'utf-8'));
await store.seed(seedData);

app.listen(3000, () => {
  console.log('API running on http://localhost:3000');
});
