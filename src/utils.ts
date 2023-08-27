import { verifyKey } from 'discord-interactions'
import { ethers } from 'ethers'
import { createClient } from 'redis'
import { GRAPHQL_URL } from './constants'
import * as dotenv from 'dotenv'
dotenv.config()

// redis client
export const createRedisClient = () => createClient({
  socket: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: 6379,
  },
  password: process.env.REDIS_PASSWORD ?? 'password'
}).on('error', (err) => console.log('Redis Error', err))

export function VerifyDiscordRequest(clientKey: string) {
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

export async function DiscordRequest(endpoint: string, options: any): Promise<Response> {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint
  // Stringify payloads
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (options?.body) options.body = JSON.stringify(options.body)

  if (process.env.DISCORD_TOKEN === undefined) {
    throw new Error('Discord token is undefined')
  }

  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'AxieDiscordBot (https://github.com/alexx855/axie-discord-bot, 1.1.0)'
    },
    ...options
  })

  // handle API errors
  if (!res.ok) {
    const data = await res.json()
    // throw new Error(JSON.stringify(data))
    console.error(data)
  }
  // return original response
  return res
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export async function fetchAxieQuery<T>(query: string, variables: { [key: string]: any }, headers?: { [key: string]: any }) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'x-api-key': process.env.SKIMAVIS_DAPP_KEY as string,
      ...headers
    },
    body: JSON.stringify({ query, variables })
  })

  const res: T = await response.json()
  return res
}

export const ethToWei = (eth: number) => ethers.utils.parseEther(eth.toString())

export async function InstallGuildCommands(appId: string, guildId: string, commands: any[]) {
  // API endpoint to overwrite guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands })
  } catch (err) {
    console.error(err)
  }
}

export async function InstallGlobalCommands(appId: string, commands: any[]) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands })
  } catch (err) {
    console.error(err)
  }
}
