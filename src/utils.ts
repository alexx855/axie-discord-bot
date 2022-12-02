/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { verifyKey } from 'discord-interactions'
import { ethers } from 'ethers'
import { createClient } from 'redis'
import { GRAPHQL_URL } from '../constants'
import { Client } from 'pg'
import * as dotenv from 'dotenv'
dotenv.config()

// redis client
export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: 6379
  },
  password: process.env.REDIS_PASSWORD ?? 'password'
}).on('error', (err) => console.log('Redis redisClient Error', err))
// redisClient.connect().catch((err) => console.log('Redis redisClient Error', err))

// postgres client
export const postgresClient = new Client(
  {
    user: process.env.POSTGRES_USER ?? 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    database: process.env.POSTGRES_DB ?? 'axiebot',
    password: process.env.POSTGRES_PASSWORD ?? 'password',
    port: 5432
  }
).on('error', (err) => console.log('Postgres postgresClient Error', err))
// postgresClient.connect().catch((err) => console.log('Postgres postgresClient Error', err))

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
  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN as string}`,
      'Content-Type': 'application/json; charset=UTF-8'
      // 'User-Agent': 'AxieDiscordBot (https://github.com/alexx855/axie-discord-bot, 1.0.0)'
    },
    ...options
  })
  // throw API errors
  if (!res.ok) {
    const data = await res.json()
    // console.log(res.status)
    throw new Error(JSON.stringify(data))
  }
  // return original response
  return res
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export async function fetchApi<T>(query: string, variables: { [key: string]: any }, headers?: { [key: string]: any }): Promise<T | null> {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ query, variables })
    })

    const res: T = await response.json()
    return res
  } catch (error) {
    console.log(error)
    return null
  }
}

export const ethToWei = (eth: number) => ethers.utils.parseEther(eth.toString())

export const getRandomMessage = async (): Promise<string | false> => {
  const query = `mutation CreateRandomMessage {
    createRandomMessage
  }`
  interface IRandomMessage {
    data?: {
      createRandomMessage: string
    }
    errors?: {
      message: string
    }
  }
  const res = await fetchApi<IRandomMessage>(query, {})

  if (res === null || res.data === undefined) {
    return false
  }
  return res.data.createRandomMessage
}

export const createAccessTokenWithSignature = async (owner: string, message: string, signature: string): Promise<string | false> => {
  const query = `mutation CreateAccessTokenWithSignature($input: SignatureInput!) {
    createAccessTokenWithSignature(input: $input) {
      newAccount
      result
      accessToken
      __typename
    }
  }`
  interface ICreateAccessTokenResponse {
    data?: {
      createAccessTokenWithSignature: {
        accessToken: string
      }
    }
    errors?: {
      message: string
    }
  }

  const variables = { input: { mainnet: 'ronin', owner, message, signature } }
  const res = await fetchApi<ICreateAccessTokenResponse>(query, variables)

  if (res !== null) {
    if (res.data?.createAccessTokenWithSignature.accessToken !== undefined) {
      return res.data.createAccessTokenWithSignature.accessToken
    }

    if (res.errors !== undefined) {
      console.error(res.errors)
    }
  }

  console.log('Error creating access token')
  return false
}

export function HasGuildCommands(
  appId: string,
  guildId: string,
  commands: any[]
) {
  if (guildId === '' || appId === '') return

  commands.forEach((c: any) => {
    HasGuildCommand(appId, guildId, c).catch((err) => {
      console.error('Error checking command:', err)
    })
  })
}

// Checks for a command
async function HasGuildCommand(
  appId: string,
  guildId: string,
  command: { [x: string]: any }
) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`

  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' })
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (data) {
      // This is just matching on the name, so it's not good for updates
      const installedNames = data.map((c: any) => c.name)
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!installedNames.includes(command.name)) {
        console.log(`Installing "${command.name}"`)
        InstallGuildCommand(appId, guildId, command).catch((err) => {
          console.error('Error installing command:', err)
        })
      }
      // Uncomment this to update commands if you change something like the modal
      // else {
      //   console.log(`"${command.name}" command already installed`)
      //   // Update command
      //   const commandId = data.find((c: any) => c.name === command.name).id
      //   UpdateGuildCommand(appId, guildId, commandId, command).catch((err) => {
      //     console.error('Error updating command:', err)
      //   })
      // }
    }
  } catch (err) {
    console.error(err)
  }
}

// Updates a command
export async function UpdateGuildCommand(
  appId: any,
  guildId: any,
  commandId: any,
  command: { [x: string]: any }
) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands/${commandId}`

  try {
    const res = await DiscordRequest(endpoint, { method: 'PATCH', body: command })
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (data) {
      console.log(`"${command.name}" command updated`)
    }
  } catch (err) {
    console.error(err)
  }
}

// Installs a command
export async function InstallGuildCommand(
  appId: any,
  guildId: any,
  command: any
) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`
  // install command
  try {
    await DiscordRequest(endpoint, { method: 'POST', body: command })
  } catch (err) {
    console.error(err)
  }
}

export function getClassColor(axieClassName: string) {
  let color = 0x000000
  switch (axieClassName) {
    case 'Beast':
      color = 0xfdb014
      break
    case 'Bug':
      color = 0xff433e
      break
    case 'Bird':
      color = 0xfa59a0
      break
    case 'Plant':
      color = 0xafdb1b
      break
    case 'Aquatic':
      color = 0x00f5f8
      break
    case 'Reptile':
      color = 0x9967fb
      break
    case 'Dusk':
      color = 0x29fae
      break
    case 'Dawn':
      color = 0x7183e3
      break
    case 'Mech':
      color = 0x71898e
      break
    default:
      color = 0xffffff
      break
  }

  return color
}

export async function getAxieTransferHistory(axieId: string) {
  const query = 'query GetAxieTransferHistory($axieId: ID!, $from: Int!, $size: Int!) {\n\taxie(axieId: $axieId) {\n\t\tid\n\t\ttransferHistory(from: $from, size: $size) {\n\t\t\t...TransferRecords\n\t\t\t__typename\n\t\t}\n\t\tethereumTransferHistory(from: $from, size: $size) {\n\t\t\t...TransferRecords\n\t\t\t__typename\n\t\t}\n\t\t__typename\n\t}\n}\nfragment TransferRecords on TransferRecords {\n\ttotal\n\tresults {\n\t\tfrom\n\t\tto\n\t\ttimestamp\n\t\ttxHash\n\t\twithPrice\n\t\t__typename\n\t}\n\t__typename\n}\n'
  interface IGetAxieTransferHistoryResponse {
    data: {
      axie: {
        id: string
        transferHistory: {
          total: number
          results: Array<{
            from: string
            to: string
            timestamp: number
            txHash: string
            withPrice: number
          }>
        }
        ethereumTransferHistory: {
          total: number
          results: Array<{
            from: string
            to: string
            timestamp: number
            txHash: string
            withPrice: number
          }>
        }
      }
    }
  }
  const variables = { axieId, from: 0, size: 5 }
  const res = await fetchApi<IGetAxieTransferHistoryResponse>(query, variables)
  return res === null || res.data.axie === undefined ? null : res.data.axie
}

// const minPrice = ethers.BigNumber.from((await getMinPriceAxie(listing.id)))
// console.log(`minPrice: ${ethers.utils.formatEther(minPrice)}`)
export async function getMinPriceAxie(axieId: string) {
  const query = 'query GetMinPriceAxie($axieId: ID!) {\n  axie(axieId: $axieId) {\n    id\n    minPrice\n    __typename\n  }\n}\n'
  interface IGetMinPriceAxieResponse {
    data: {
      axie: {
        id: string
        minPrice: number
      }
    }
  }
  const variables = { axieId }
  const res = await fetchApi<IGetMinPriceAxieResponse>(query, variables)
  return res === null || res.data.axie === undefined ? null : res.data.axie.minPrice
}

export async function getFloorPrice() {
  await redisClient.connect()
  const lastId = await redisClient.get('floorPrice')
  await redisClient.disconnect()
  return lastId ?? '0'
}

export async function setFloorPrice(price: string) {
  await redisClient.connect()
  await redisClient.set('floorPrice', price)
  await redisClient.disconnect()
}
