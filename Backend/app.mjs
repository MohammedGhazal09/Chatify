import express from 'express';
import authRouter from './Routes/authRouter.mjs';
import userRouter from './Routes/userRouter.mjs'
import errHandler from './Controller/errController.mjs';
import protect from './Middlewares/protectRoutes.mjs';
const app = express();

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/user', protect, userRouter);

app.
app.use(errHandler);
export default app;