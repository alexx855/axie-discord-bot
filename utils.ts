/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import * as dotenv from 'dotenv'

import { verifyKey } from 'discord-interactions'
dotenv.config()

export function VerifyDiscordRequest (clientKey: string) {
  return function (req: any, res: any, buf: any, encoding: any) {
    const signature = req.get('X-Signature-Ed25519')
    const timestamp = req.get('X-Signature-Timestamp')

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey)
    if (!isValidRequest) {
      res.status(401).send('Bad request signature')
      throw new Error('Bad request signature')
    }
  }
}

export async function DiscordRequest (endpoint: string, options: any): Promise<Response> {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint
  // Stringify payloads
  if (options?.body) options.body = JSON.stringify(options.body)
  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN as string}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent':
        'AxieDiscordBot (https://github.com/alexx855/axie-discord-bot, 1.0.0)'
    },
    ...options
  })
  // throw API errors
  if (!res.ok) {
    const data = await res.json()
    console.log(res.status)
    throw new Error(JSON.stringify(data))
  }
  // return original response
  return res
}

export function capitalize (str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
