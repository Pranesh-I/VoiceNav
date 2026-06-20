import { Router } from 'express';
import { userRouter } from './users';
import productRouter from './products';

const apiRouter = Router();

apiRouter.get('/status', (req, res) => res.json({ status: 'up' }));

// Nested mounts
apiRouter.use('/v1/users', userRouter);
apiRouter.use('/v1/products', productRouter);

export default apiRouter;
