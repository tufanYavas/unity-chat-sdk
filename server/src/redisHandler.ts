import Redis, { RedisOptions } from 'ioredis';
import { Message, User } from './types';



export async function setupRedisHandler() {
  // Environment variable safety checks and type casting
  const CHAT_HISTORY_KEY = process.env.CHAT_HISTORY_KEY!;
  const ACTIVE_USERS_KEY = process.env.ACTIVE_USERS_KEY!;
  const MESSAGE_EXPIRY = parseInt(process.env.MESSAGE_EXPIRY!, 10); // Ensuring it's a number
  const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES!, 10); // Ensuring it's a number

  // Ensure these environment variables are set
  if (!CHAT_HISTORY_KEY || !ACTIVE_USERS_KEY || isNaN(MESSAGE_EXPIRY) || isNaN(MAX_MESSAGES)) {
    throw new Error('Missing or invalid environment variables');
  }

  const redisOptions: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`Retrying Redis connection in ${delay}ms...`);
      return delay;
    },
    maxRetriesPerRequest: 3,
  };

  const redisClient = new Redis(redisOptions);

  redisClient.on('connect', () => {
    console.log('Successfully connected to Redis');
  });

  redisClient.on('error', (error) => {
    console.error('Redis connection error:', error);
  });

  // Ensuring Redis is responsive
  try {
    await redisClient.ping();
  } catch (error) {
    console.error('Redis ping failed:', error);
    throw new Error('Failed to connect to Redis');
  }

  return {
    saveMessage: async (message: Message): Promise<void> => {
      try {
        const pipeline = redisClient.pipeline();
        pipeline.rpush(CHAT_HISTORY_KEY, JSON.stringify(message));
        pipeline.ltrim(CHAT_HISTORY_KEY, -MAX_MESSAGES, -1); // Keep only last MAX_MESSAGES
        pipeline.expire(CHAT_HISTORY_KEY, MESSAGE_EXPIRY); // Set message expiry time
        await pipeline.exec();
        console.log('Message saved successfully');
      } catch (error) {
        console.error('Error saving message to Redis:', error);
      }
    },

    getMessages: async (limit: number = 100): Promise<Message[]> => {
      try {
        const messages = await redisClient.lrange(CHAT_HISTORY_KEY, -limit, -1);
        return messages.map((msg) => JSON.parse(msg));
      } catch (error) {
        console.error('Error retrieving messages from Redis:', error);
        return [];
      }
    },

    addActiveUser: async (user: User): Promise<void> => {
      try {
        await redisClient.hset(ACTIVE_USERS_KEY, user.id, JSON.stringify(user));
        console.log(`Active user ${user.id} added`);
      } catch (error) {
        console.error('Error adding active user to Redis:', error);
      }
    },

    removeActiveUser: async (user: User): Promise<void> => {
      try {
        await redisClient.hdel(ACTIVE_USERS_KEY, user.id);
        console.log(`Active user ${user.id} removed`);
      } catch (error) {
        console.error('Error removing active user from Redis:', error);
      }
    },

    getActiveUsers: async (): Promise<User[]> => {
      try {
        const users = await redisClient.hgetall(ACTIVE_USERS_KEY);
        return Object.values(users).map((user) => JSON.parse(user));
      } catch (error) {
        console.error('Error retrieving active users from Redis:', error);
        return [];
      }
    },

    clearExpiredData: async (): Promise<void> => {
      try {
        await redisClient.expire(CHAT_HISTORY_KEY, MESSAGE_EXPIRY);
        console.log('Expired data cleared successfully');
      } catch (error) {
        console.error('Error clearing expired data in Redis:', error);
      }
    },

    quit: async (): Promise<void> => {
      try {
        await redisClient.quit();
        console.log('Redis connection closed gracefully');
      } catch (error) {
        console.error('Error while closing Redis connection:', error);
      }
    }
  };
}