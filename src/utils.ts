import { verifyKey } from 'discord-interactions'
import { GRAPHQL_URL } from './constants'
import { type Request, type Response } from 'express'

export function VerifyDiscordRequest (clientKey: string) {
  return function (req: Request, res: Response, buf: Buffer) {
    const signature = req.get('X-Signature-Ed25519')
    const timestamp = req.get('X-Signature-Timestamp')

    if (signature === null || timestamp === null || signature === undefined || timestamp === undefined) {
      res.status(400).send('Missing signature or timestamp')
      throw new Error('Missing signature or timestamp')
    }

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey)
    if (!isValidRequest) {
      res.status(401).send('Bad request signature')
      throw new Error('Bad request signature')
    }
  }
}

export async function discordRequest(endpoint: string, options: { method?: string, body?: any } = {}) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint
  if (options?.body) options.body = JSON.stringify(options.body)

  const token = process.env.DISCORD_TOKEN
  if (token === undefined) {
    throw new Error('Discord token is undefined')
  }

  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': `AxieDiscordBot (https://github.com/alexx855/mit-night-shop-bot, ${process.env.npm_package_version})`
    },
    ...options
  })

  // handle API errors
  if (!res.ok) {
    const data = await res.json()
    console.error(data)
  }
  // return original response
  return res
}

export async function apiRequest<T> (
  url: string,
  body: BodyInit | null = null,
  headers: Record<string, string> = {},
  method: string = 'POST'
) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...(method === 'GET' ? {} : { body })
  })

  const res: T = await response.json()
  return res
}

export function capitalize (str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export async function fetchAxieQuery<T> (query: string, variables: Record<string, any>, headers?: Record<string, string>, method = 'POST') {
  const response = await apiRequest<T>(GRAPHQL_URL, JSON.stringify({ query, variables }), headers, method)
  return response
}

export async function InstallGuildCommands (appId: string, guildId: string, commands: any[]) {
  // API endpoint to overwrite guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    const request = await discordRequest(endpoint, { method: 'PUT', body: commands })
    console.log(request)
  } catch (err) {
    console.error(err)
  }
}

export async function InstallGlobalCommands (appId: string, commands: any[]) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    const request = await discordRequest(endpoint, { method: 'PUT', body: commands })
    console.log(request)
  } catch (err) {
    console.error(err)
  }
}

// Deletes all bot commands
export async function DeleteCommands () {
  if (process.env.DISCORD_CLIENT_ID === undefined || process.env.DISCORD_GUILD_ID === undefined) {
    throw new Error('Missing environment variables')
  }
  // Commands can be deleted and updated by making DELETE and PATCH calls to the command endpoint. Those endpoints are

  // applications/<my_application_id>/commands/<command_id> for global commands, or
  // applications/<my_application_id>/guilds/<guild_id>/commands/<command_id> for guild commands
  // Because commands have unique names within a type and scope, we treat POST requests for new commands as upserts. That means making a new command with an already-used name for your application will update the existing command.

  const commands = await discordRequest(`applications/${process.env.DISCORD_CLIENT_ID}/commands`, { method: 'GET' })
  // const commands = await discordRequest(`applications/${process.env.DISCORD_CLIENT_ID}/guilds/${process.env.DISCORD_GUILD_ID}/commands`, { method: 'GET' })
  const data = await commands.json()
  for (const command of data) {
    console.log(`Deleting command ${command.name} with id ${command.id}`)

    await discordRequest(`applications/${process.env.DISCORD_CLIENT_ID}/guilds/${process.env.DISCORD_GUILD_ID}/commands/${command.id}`, { method: 'DELETE' })
    await discordRequest(`applications/${process.env.DISCORD_CLIENT_ID}/commands/${command.id}`, { method: 'DELETE' })

    // wait 4 seconds to avoid rate limit
    await new Promise(resolve => setTimeout(resolve, 4000))
  }
}

export function roninAddress (address: `0x${string}`) {
  return address.replace('0x', 'ronin:').toLocaleLowerCase()
}

export function roninAddressToHex (address: string) {
  return address.replace('ronin:', '0x') as `0x${string}`
}

export function editMessage (channelId: string, messageId: string, content: string, components: any[] = []) {
  const endpoint = `channels/${channelId}/messages/${messageId}`

  void discordRequest(endpoint, {
    method: 'PATCH',
    body: {
      content,
      components
    }
  })
}
