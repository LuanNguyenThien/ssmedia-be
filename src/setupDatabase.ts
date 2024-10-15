import mongoose from 'mongoose';
import Logger from 'bunyan';
import { config } from '@root/config';
// import { redisConnection } from '@service/redis/redis.connection';
// import { redisService } from '@service/redis/redis.service';

const log: Logger = config.createLogger('setupDatabase');

export default () => {
  const connect = () => {
    mongoose
      .connect(`${config.DATABASE_URL}`)
      .then(() => {
        log.info('Successfully connected to database.');
      })
      .catch((error) => {
        log.error('Error connecting to database', error);
        return process.exit(1);
      });
  };
  connect();

  mongoose.connection.on('disconnected', connect);
};
