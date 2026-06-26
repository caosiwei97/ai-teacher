import { Queue } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const chatQueue = new Queue("chat-turn", { connection });

// 迭代 009：学习资料异步处理队列（解析→分块→embedding→入库）
export const sourceQueue = new Queue("source-processing", { connection });
