import express from 'express';
import authRouter from './Routes/authRouter.mjs';
import userRouter from './Routes/userRouter.mjs'
import chatRouter from './Routes/chatRouter.mjs';
import messageRouter from './Routes/messageRouter.mjs';
import errHandler from './Controller/errController.mjs';
import protect from './Middlewares/protectRoutes.mjs';
import { CustomError } from './Utils/customError.mjs';
const app = express();

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/user', protect, userRouter);
app.use('/api/chat', protect, chatRouter);
app.use('/api/message', protect, messageRouter);

app.use((req, res, next) => {
  const error = new CustomError(`Can't find ${req.originalUrl} on this server`, 404);
  next(error);
});

app.use(errHandler);
export default app;