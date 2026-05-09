import { Queue } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const chatQueue = new Queue("chat-turn", { connection });
