/**
 * Shared Redis client for Vercel (KV_REST_API_* or UPSTASH_REDIS_REST_*).
 * Used by invoice-intent-storage and pending-mint-wires.
 */

import type { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function useRedis(): boolean {
  const hasRedis =
    (process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (process.env.VERCEL) {
    if (!hasRedis) {
      throw new Error(
        "On Vercel, Redis is required. Add Upstash Redis from Storage/Integrations."
      );
    }
    return true;
  }
  return !!hasRedis;
}

export async function getRedisClient(): Promise<Redis> {
  if (_redis) return _redis;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("Redis URL or token not set");
  }
  const { Redis } = await import("@upstash/redis");
  _redis = new Redis({ url, token });
  return _redis;
}
