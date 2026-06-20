import express, { Router } from 'express';

const app = express();
const taskRouter = Router();

app.get('/api/tasks', (req, res) => res.json([]));
app.post('/api/tasks', (req, res) => res.json({}));

taskRouter.delete('/:id', (req, res) => res.json({}));

app.use('/api/tasks', taskRouter);

export default app;
