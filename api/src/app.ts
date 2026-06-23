import express from 'express';
import cors from 'cors';
import { assetRouter } from './routes/assets.routes.js';
import { errorHandler } from './middleware/error.js';
import { MemoryStore } from './store/memory.store.js';

export const store = new MemoryStore();

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use((req, _, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
app.use('/assets', assetRouter(store));
app.use(errorHandler);

export default app;
