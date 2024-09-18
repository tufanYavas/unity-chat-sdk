import { connect, NatsConnection, StringCodec, Subscription, NatsError, Status } from 'nats';
import { Message } from './types';

export async function setupNatsHandler() {
  if (!process.env.NATS_URL) throw new Error('You need to specify NATS_URL in .env')
  const servers = process.env.NATS_URL.split(',');

  let nc: NatsConnection;

  try {
    nc = await connect({
      servers,
      timeout: 3000, // 3 seconds connection timeout
      maxReconnectAttempts: -1, // Infinite reconnection attempts
      reconnectTimeWait: 1000, // Wait 1 second between reconnection attempts
    });

    console.log('Connected to NATS cluster');

    nc.closed()
      .then(err => {
        if (err) {
          console.error(`NATS connection closed due to error: ${err.message}`);
        } else {
          console.log('NATS connection closed');
        }
      });

    (async () => {
      for await (const status of nc.status()) {
        handleStatus(status);
      }
    })();

  } catch (err) {
    console.error(`Failed to connect to NATS cluster: ${(err as Error).message}`);
    throw err; // Re-throw to allow caller to handle the error
  }

  const sc = StringCodec();

  function handleStatus(status: Status) {
    switch (status.type) {
      case 'disconnect':
        console.warn('NATS connection lost: ', status.data);
        break;
      case 'reconnect':
        console.log('NATS reconnected to ', status.data);
        break;
      case 'update':
        console.log('NATS connection updated: ', status.data);
        break;
      case 'ldm':
        console.log('NATS LDM event: ', status.data);
        break;
      case 'error':
        console.error('NATS connection error: ', status.data);
        break;
    }
  }

  return {
    publishMessage: (message: Message) => {
      try {
        nc.publish('chat.messages', sc.encode(JSON.stringify(message)));
      } catch (err) {
        console.error(`Failed to publish message: ${(err as Error).message}`);
      }
    },

    subscribeToMessages: (callback: (message: Message) => void): Subscription => {
      const subscription = nc.subscribe('chat.messages', {
        queue: 'chat_workers'
      });
      (async () => {
        try {
          for await (const msg of subscription) {
            try {
              const decodedMsg = JSON.parse(sc.decode(msg.data));
              callback(decodedMsg);
            } catch (err) {
              console.error(`Failed to process received message: ${(err as Error).message}`);
            }
          }
        } catch (err) {
          console.error(`Error in message subscription: ${(err as Error).message}`);
        }
      })();
      return subscription;
    },
    unsubscribeFromMessages: (subscription: Subscription) => {
      try {
        subscription.unsubscribe();
        console.log('Unsubscribed from NATS topic');
      } catch (err) {
        console.error(`Failed to unsubscribe: ${(err as Error).message}`);
      }
    },
    closeConnection: async () => {
      try {
        await nc.drain();
        await nc.close();
        console.log('NATS connection closed gracefully');
      } catch (err) {
        console.error(`Error while closing NATS connection: ${(err as Error).message}`);
      }
    }

  };
}