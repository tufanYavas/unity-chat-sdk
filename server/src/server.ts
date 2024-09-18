import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupNatsHandler } from './natsHandler';
import { setupRedisHandler } from './redisHandler';
import { User, Message } from './types';
import { configDotenv } from 'dotenv';
configDotenv()

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

async function startServer() {
  const redisHandler = await setupRedisHandler();
  const natsHandler = await setupNatsHandler();

  // Remove all users from Redis on startup
  try {
    (await redisHandler.getActiveUsers()).map(async (user) => await redisHandler.removeActiveUser(user))
  } catch (error) {
    console.error('Failed to recover state from Redis:', error);
  }


  // Token validation Middleware
  io.use((socket, next) => {
    const token = socket.handshake.query.token;
    if (token === 'UNITY') {
      return next();
    }
    console.log("Token validation failed.");
    return next(new Error('Authentication error'));
  });

  io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('join', async (user: User) => {
      console.log("join", user);
      socket.data.userId = user.id;
      try {
        await redisHandler.addActiveUser(user);
        const messages = await redisHandler.getMessages();
        console.log({messages});
        socket.broadcast.emit('user_joined', user);
        socket.emit('chat_history', messages);
      } catch (error) {
        console.error('Failed to process join:', error);
        socket.emit('error', 'Failed to join the chat');
      }
    });

    socket.on('message', async (message: Message) => {
      console.log(message);
      message.timestamp = message.timestamp || Date.now();

      try {
        await redisHandler.saveMessage(message);
        natsHandler.publishMessage(message);
      } catch (error) {
        console.error('Failed to process message:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    socket.on('disconnect', async () => {
      const userId = socket.data.userId;
      const activeUsers = await redisHandler.getActiveUsers();
      const userToRemove = activeUsers.find(user => user.id === userId);
      if (userToRemove) {
        try {
          await redisHandler.removeActiveUser(userToRemove);
          socket.broadcast.emit('user_left', userToRemove);
        } catch (error) {
          console.error('Failed to process disconnect:', error);
        }
      }
    });
  });

  const messageSubscription = natsHandler.subscribeToMessages((message: Message) => {
    io.emit('new_message', message);
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    io.close();
    await messageSubscription.drain();
    await natsHandler.closeConnection();
    await redisHandler.quit();
    process.exit(0);
  });

  const port = 3000;
  httpServer.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch(console.error);