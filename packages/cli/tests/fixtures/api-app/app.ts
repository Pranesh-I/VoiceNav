import express from 'express';
import apiRouter from './routes/api';

const app = express();

app.get('/health', (req, res) => res.send('OK'));

app.use('/api', apiRouter);

export default app;
