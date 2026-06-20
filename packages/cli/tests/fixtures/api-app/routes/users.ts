import { Router } from 'express';

export const userRouter = Router();

userRouter.get('/', (req, res) => res.json([]));
userRouter.post('/', (req, res) => res.json({}));
userRouter.get('/:id', (req, res) => res.json({}));
userRouter.put('/:id', (req, res) => res.json({}));
userRouter.delete('/:id', (req, res) => res.json({}));
