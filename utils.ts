/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import * as dotenv from 'dotenv'

import { verifyKey } from 'discord-interactions'
import { GRAPHQL_URL } from './constants'
import { ethers } from 'ethers'
import { createClient } from 'redis'
import { Client } from 'pg'
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

export interface IMarketOrder {
  id: number
  userId: string
  marketProps: MarketPropsInterface
  marketUrl: string
  triggerPrice: string
}

export interface ITriggerOrder {
  id: number
  axieId: string
  marketProps: MarketPropsInterface
  triggerPrice: string
  currentPrice: string
  status: 'pending' | 'triggered' | 'failed' | 'completed'
}

export interface MarketPropsInterface {
  class: string[]
  part: string[]
  triggerPrice: string
  breedCount: number
  pureness: number
  // [key: string]: any
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

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// convert the function fetchMarket from the python script axie.py to a typescript function
export async function fetchApi(query: string, variables: { [key: string]: any }): Promise<any> {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // 'Authorization': 'Bearer ' + accessToken,
        // 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.0)',
      },
      body: JSON.stringify({ query, variables })
    })

    const res = await response.json()
    // todo: handle errors
    return res.data
  } catch (error) {
    return error
  }
}

export async function fetchMarketResultsByCriteria(marketProps: MarketPropsInterface): Promise<ITriggerOrder[]> {
  const orders: ITriggerOrder[] = []
  const query = 'query GetAxieBriefList($auctionType:AuctionType,$criteria:AxieSearchCriteria,$from:Int,$sort:SortBy,$size:Int,$owner:String){axies(auctionType:$auctionType,criteria:$criteria,from:$from,sort:$sort,size:$size,owner:$owner,){total,results{id,order{...on Order{id,maker,kind,assets{...on Asset{erc,address,id,quantity,orderId}}expiredAt,paymentToken,startedAt,basePrice,endedAt,endedPrice,expectedState,nonce,marketFeePercentage,signature,hash,duration,timeLeft,currentPrice,suggestedPrice,currentPriceUsd}}}}}'

  const variables = {
    from: 0,
    size: 100,
    sort: 'PriceAsc',
    auctionType: 'Sale',
    criteria: {
      classes: marketProps.class,
      parts: marketProps.part,
      breedCount: marketProps.breedCount,
      pureness: marketProps.pureness
      // ...criteria
      // todo: add the rest of the criteria
    }
  }

  // get results from the market
  const response = await fetchApi(query, variables)
  const results = response.axies.results
  if (results) {
    const total = response.axies.total

    // if there are more than 100, interate over the pages
    while (total > results.length) {
      variables.from += 100
      const response = await fetchApi(query, variables)
      results.push(...response.axies.results)
      // await some time to avoid rate limit
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // process the results and check if some meet the market criteria
    for (const result of results) {
      const orderId = result.order.id
      const axieId = result.order.assets[0].id as string
      // const expiredAt = result.order.expiredAt;
      // const startedAt = result.order.startedAt;
      // const basePrice = result.order.basePrice;
      // const endedAt = result.order.endedAt;
      // const endedPrice = result.order.endedPrice;
      // const duration = result.order.duration;
      // const timeLeft = result.order.timeLeft;
      // const suggestedPrice = result.order.suggestedPrice;
      const currentPrice = ethers.BigNumber.from(result.order.currentPrice)
      const triggerPrice = ethers.BigNumber.from(ethers.utils.parseUnits(marketProps.triggerPrice, 'ether'))

      let info = `Axie ID: ${axieId}\n`
      // info += `Expired At: ${new Date(expiredAt * 1000).toLocaleString()}\n`
      // info += `Started At: ${new Date(startedAt * 1000).toLocaleString()}\n`
      // info += `Base Price: ${ethers.utils.formatEther(basePrice)}\n`
      // info += `Ended At: ${new Date(endedAt * 1000).toLocaleString()}\n`
      // info += `Ended Price: ${ethers.utils.formatEther(endedPrice)}\n`
      // info += `Duration: ${duration}\n`
      // info += `Time Left: ${timeLeft}\n`
      // info += `Suggested Price: ${ethers.utils.formatEther(suggestedPrice)}\n`
      // info += `Current Price: ${currentPrice}\n`
      // info += `Trigger Price: ${triggerPrice}\n`
      info += `Current Price: ${ethers.utils.formatEther(currentPrice)}\n`
      info += `Trigger Price: ${ethers.utils.formatEther(triggerPrice)}\n`
      info += '----------------------------------------\n'
      // if trigger price is reached, push to orders array
      if (triggerPrice.gte(currentPrice)) {
        // console.log(info)
        orders.push({
          id: orderId,
          axieId,
          marketProps,
          triggerPrice: triggerPrice.toString(),
          currentPrice: currentPrice.toString(),
          status: 'pending'
        })
      }
    }
  }

  return orders
}

export async function getMarketOrders() {
  const ordersArray: IMarketOrder[] = []

  const orders = await redisClient.get('orders')

  if (orders !== null) {
    ordersArray.push(...JSON.parse(orders))
  }

  return ordersArray
}

export async function setMarketOrders(orders: IMarketOrder[]) {
  return await redisClient.set('orders', JSON.stringify(orders))
}

export async function removeMarketOrder(orderId: number) {
  const orders = await getMarketOrders()
  // Check if order exists
  const orderIndex = orders.findIndex(order => order.id === orderId)
  if (orderIndex !== -1) {
    // Remove the order
    orders.splice(orderIndex, 1)
    // Set orders
    await setMarketOrders(orders)
  }
}

export function execOrders(order: ITriggerOrder, markeOrder: IMarketOrder) {
  // remove the market order from the orders array, to prevent it from being executed again
  // removeMarketOrder(markeOrder.id)

  // todo: execute the order on ronin network

}
