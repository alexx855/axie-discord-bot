/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { verifyKey } from 'discord-interactions'
import { GRAPHQL_URL } from './constants'
import { ethers } from 'ethers'
import { createClient } from 'redis'
// import { Client } from 'pg'

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
// export const postgresClient = new Client(
//   {
//     user: process.env.POSTGRES_USER ?? 'postgres',
//     host: process.env.POSTGRES_HOST ?? 'localhost',
//     database: process.env.POSTGRES_DB ?? 'axiebot',
//     password: process.env.POSTGRES_PASSWORD ?? 'password',
//     port: 5432
//   }
// ).on('error', (err) => console.log('Postgres postgresClient Error', err))
// postgresClient.connect().catch((err) => console.log('Postgres postgresClient Error', err))

export interface IMarketOrder {
  id: string
  userId: string
  marketProps: MarketPropsInterface
  marketUrl: string
  triggerPrice: string
  floorPrice?: string
}
export interface IAsset {
  [key: string]: any
}

export interface ITriggerOrder {
  id: string
  axieId: string
  maker: string
  assets: IAsset[]
  basePrice: string
  triggerPrice: string
  currentPrice: string
  endedAt: string
  endedPrice: string
  expiredAt: string
  startedAt: string
  nonce: string
  signature: string
}

export interface MarketPropsInterface {
  classes?: string[]
  parts?: string[]
  breedCount?: string[]
  pureness?: string[]
  excludeParts?: string[]
  // [key: string]: any
}

export interface Criteria {
  classes?: string[]
  parts?: string[]
  breedCount?: number[]
  pureness?: number[]
}

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

// convert the function fetchMarket from the python script axie.py to a typescript function
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

export async function fetchMarketResultsByOrder(marketOrder: IMarketOrder): Promise<ITriggerOrder[]> {
  // console.log('fetchMarketResultsByOrder', marketOrder)
  const marketProps = marketOrder.marketProps
  const orders: ITriggerOrder[] = []
  const query = `
    query GetAxieBriefList(
      $auctionType: AuctionType
      $criteria: AxieSearchCriteria
      $from: Int
      $sort: SortBy
      $size: Int
      $owner: String
    ) {
      axies(
        auctionType: $auctionType
        criteria: $criteria
        from: $from
        sort: $sort
        size: $size
        owner: $owner
      ) {
        total
        results {
          id
          order {
            ... on Order {
              id
              maker
              kind
              assets {
                ... on Asset {
                  erc
                  address
                  id
                  quantity
                  orderId
                }
              }
              expiredAt
              paymentToken
              startedAt
              basePrice
              endedAt
              endedPrice
              expectedState
              nonce
              marketFeePercentage
              signature
              hash
              duration
              timeLeft
              currentPrice
              suggestedPrice
              currentPriceUsd
            }
          }
        }
      }
    }
  `
  interface IAxieBriefListResult {
    data: {
      axies: {
        total: number
        results: Array<{
          id: string
          order: {
            id: string
            maker: string
            kind: string
            assets: IAsset[]
            expiredAt: string
            paymentToken: string
            startedAt: string
            basePrice: string
            endedAt: string
            endedPrice: string
            expectedState: string
            nonce: string
            marketFeePercentage: string
            signature: string
            hash: string
            duration: string
            timeLeft: string
            currentPrice: string
            suggestedPrice: string
            currentPriceUsd: string
          }
        }>
      }
    }
  }

  const criteria: Criteria = {}

  // validate the marketProps, not the same as the graphql criteria
  if (marketProps.classes !== undefined) {
    criteria.classes = marketProps.classes
  }

  if (marketProps.parts !== undefined) {
    criteria.parts = marketProps.parts
  }

  if (marketProps.breedCount !== undefined && marketProps.breedCount !== undefined) {
    // convert strings in the array to numbers
    criteria.breedCount = marketProps.breedCount?.map((item) => parseInt(item, 10))
  }

  if (marketProps.pureness !== undefined) {
    // convert strings in the array to numbers
    criteria.pureness = marketProps.pureness.map((item) => parseInt(item, 10))
  }

  if (marketProps.excludeParts !== undefined) {
    for (const part of marketProps.excludeParts) {
      if (criteria.parts?.includes(part) === true) {
        criteria.parts[criteria.parts.indexOf(part)] = `!${part}`
      } else {
        criteria.parts?.push(`!${part}`)
      }
    }
  }

  // console.log('criteria', criteria)

  const variables = {
    from: 0,
    size: 10, // total of results, max 100
    sort: 'PriceAsc',
    auctionType: 'Sale',
    criteria
  }

  // get results from the market
  const res = await fetchApi<IAxieBriefListResult>(query, variables)
  // console.log('res', res)
  if (res !== null && res.data.axies.total > 0) {
    const results = res.data.axies.results
    // no need for this, we always want the cheaper axie
    // const total = res.data.axies.total
    // while (total > results.length) {
    //   variables.from += 100
    //   const res = await fetchApi(query, variables)
    //   results.push(...res.axies.results)
    //   // await some time to avoid rate limit
    //   await new Promise(resolve => setTimeout(resolve, 200))
    // }

    const triggerPrice = ethers.BigNumber.from(ethers.utils.parseUnits(marketOrder.triggerPrice, 'ether'))

    // save floor price
    const floorPrice = ethers.utils.formatEther(results[0].order.currentPrice)
    // if floor price different than the one in the database, update it
    if (floorPrice !== marketOrder.floorPrice) {
      // console.log(`--new floor price ${floorPrice}`)
      // console.log(`--trigger price   ${ethers.utils.formatEther(triggerPrice)}`)
      // console.log(`--diff            ${ethers.utils.formatEther(ethers.BigNumber.from(ethers.utils.parseUnits(floorPrice, 'ether')).sub(triggerPrice))}`)
      // todo: send a message to notify the new floor price, if it threshold is reached
      marketOrder.floorPrice = floorPrice
      void updateMarketOrderFloorPrice(marketOrder)
    }

    // process the results and check if some meet the market criteria
    for (const result of results) {
      const { order } = result
      const axieId = order.assets[0].id as string
      const currentPrice = ethers.BigNumber.from(order.currentPrice)

      if (triggerPrice.gte(currentPrice)) {
        orders.push({
          id: order.id,
          axieId,
          maker: order.maker,
          assets: order.assets,
          basePrice: order.basePrice,
          triggerPrice: triggerPrice.toString(),
          currentPrice: currentPrice.toString(),
          endedAt: order.endedAt,
          endedPrice: order.endedPrice,
          expiredAt: order.expiredAt,
          startedAt: order.startedAt,
          nonce: order.nonce,
          signature: order.signature
        })
      }
    }
  }

  return orders
}

export async function getMarketOrders() {
  const ordersArray: IMarketOrder[] = []
  await redisClient.connect()

  const orders = await redisClient.get('orders')
  if (orders !== null) {
    ordersArray.push(...JSON.parse(orders))
  }

  void redisClient.disconnect()
  return ordersArray
}

export async function setMarketOrders(orders: IMarketOrder[]) {
  await redisClient.connect()
  await redisClient.set('orders', JSON.stringify(orders))
  void redisClient.disconnect()
}

export async function updateMarketOrderFloorPrice(order: IMarketOrder) {
  await removeMarketOrder(order.id)
  await addMarketOrder(order)
}

export async function addMarketOrder(newOrder: IMarketOrder) {
  // get current orders list
  const orders = await getMarketOrders()

  // save to redis
  await setMarketOrders([...orders, newOrder])
}

export async function removeMarketOrder(orderId: string) {
  const orders = await getMarketOrders()
  // Check if order exists
  const orderIndex = orders.findIndex(order => order.id === orderId)
  if (orderIndex !== -1) {
    // Remove the order
    orders.splice(orderIndex, 1)
    // Set the new orders
    await setMarketOrders(orders)
  }
}

export const ethToWei = (eth: number) => ethers.utils.parseEther(eth.toString())

export const getRandomMessage = async (): Promise<string | false> => {
  interface IRandomMessage {
    data?: {
      createRandomMessage: string
    }
    errors?: {
      message: string
    }
  }

  const query = `mutation CreateRandomMessage {
    createRandomMessage
  }`
  const res = await fetchApi<IRandomMessage>(query, {})

  if (res === null || res.data === undefined) {
    return false
  }
  return res.data.createRandomMessage
}

export const createAccessTokenWithSignature = async (owner: string, message: string, signature: string): Promise<string | false> => {
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

  const query = `mutation CreateAccessTokenWithSignature($input: SignatureInput!) {
    createAccessTokenWithSignature(input: $input) {
      newAccount
      result
      accessToken
      __typename
    }
  }`

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
