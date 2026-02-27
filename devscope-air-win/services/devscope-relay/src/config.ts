import crypto from 'node:crypto'
import { z } from 'zod'
import type { RelayKind } from './types.js'

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  RELAY_KIND: z.enum(['devscope-cloud', 'self-hosted']).default('self-hosted'),
  RELAY_SECRET: z.string().min(1).default('change-me'),
  RELAY_FINGERPRINT: z.string().optional().default(''),
  DEEP_LINK_SCHEME: z.string().default('devscope'),
  RELAY_API_KEY: z.string().optional().default(''),
  RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().int().positive().default(60)
})

export type RelayConfig = {
  port: number
  host: string
  nodeEnv: 'development' | 'test' | 'production'
  relayKind: RelayKind
  relaySecret: string
  relayFingerprint: string
  deepLinkScheme: string
  relayApiKey: string
  rateLimitMaxPerMinute: number
}

function deriveFingerprint(secret: string): string {
  return crypto.createHash('sha256').update(`devscope-relay:${secret}`).digest('hex').slice(0, 24)
}

export function loadConfig(env: NodeJS.ProcessEnv): RelayConfig {
  const parsed = schema.parse(env)
  return {
    port: parsed.PORT,
    host: parsed.HOST,
    nodeEnv: parsed.NODE_ENV,
    relayKind: parsed.RELAY_KIND,
    relaySecret: parsed.RELAY_SECRET,
    relayFingerprint: parsed.RELAY_FINGERPRINT || deriveFingerprint(parsed.RELAY_SECRET),
    deepLinkScheme: parsed.DEEP_LINK_SCHEME,
    relayApiKey: parsed.RELAY_API_KEY,
    rateLimitMaxPerMinute: parsed.RATE_LIMIT_MAX_PER_MINUTE
  }
}
