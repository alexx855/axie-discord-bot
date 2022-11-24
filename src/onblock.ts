import { ethers } from 'ethers'
import { run } from 'hardhat'
import { ICriteria, IMarketBuyOrder } from './interfaces'
import { getMarketOrders, fetchMarketByCriteria, removeMarketOrder, updateMarketOrder } from './market'
import { DiscordRequest } from './utils'

const MAX_PRICE = ethers.utils.parseUnits('0.1', 'ether') // the max willing to pay per axie, in ETH, just a safe to avoid buy expensive axies that wont sell for a while

export const saveLatestMarketSales = async () => {
  console.log('saveLatestMarketSales started')
  // todo: get latest sales from the market api and save it to postgres db
}

export const marketOrdersChecker = async () => {
  // track time
  // const startTime = Date.now()
  console.log('marketOrdersChecker started')

  try {
    // get buy orders from redis
    const marketOrders = await getMarketOrders()
    if (marketOrders.length > 0) {
      for (let i = 0; i < marketOrders.length; i++) {
        const marketOrder = marketOrders[i]
        console.log(`checking order ${marketOrder.id} for user ${marketOrder.userId}`)

        // validate the marketProps, not the same as the graphql criteria
        const criteria: ICriteria = {}
        const marketProps = marketOrder.marketProps
        const triggerPrice = ethers.BigNumber.from(ethers.utils.parseUnits(marketOrder.triggerPrice, 'ether'))

        if (marketProps.classes !== undefined) {
          criteria.classes = marketProps.classes
        }

        if (marketProps.parts !== undefined) {
          criteria.parts = marketProps.parts
        }

        if (marketProps.breedCount !== undefined) {
          // convert strings in the array to numbers
          criteria.breedCount = marketProps.breedCount?.map((item) => parseInt(item, 10))
        }

        if (marketProps.pureness !== undefined) {
          // convert strings in the array to numbers
          criteria.pureness = marketProps.pureness.map((item) => parseInt(item, 10))
        }

        // add ! to the excluded parts and merge with the criteria parts array
        if (marketProps.excludeParts !== undefined) {
          for (const part of marketProps.excludeParts) {
            if (criteria.parts?.includes(part) === true) {
              criteria.parts[criteria.parts.indexOf(part)] = `!${part}`
            } else {
              criteria.parts?.push(`!${part}`)
            }
          }
        }

        const res = await fetchMarketByCriteria(criteria, 0, 3, 'Latest', 'Sale')

        if (res === false) {
          console.log('\x1b[91m%s\x1b[0m', 'error fetching market api')
          continue
        }

        // get the first result, the cheapest one
        const result = res.results[0]

        // save floor price if changed, maybe its an auction
        const floorPrice = ethers.utils.formatEther(result.order.currentPrice)
        if (floorPrice !== marketOrder.floorPrice) {
          marketOrder.floorPrice = floorPrice
          void updateMarketOrder(marketOrder)
        }

        const currentPrice = ethers.BigNumber.from(result.order.currentPrice)

        // check if the current price is lower than the trigger price, if so, buy the axie
        if (triggerPrice.gte(currentPrice) && currentPrice.lte(MAX_PRICE)) {
          // remove the market order from the orders array, to prevent it from being executed again
          await removeMarketOrder(marketOrder.id)

          const axieId = result.order.assets[0].id as string
          const order: IMarketBuyOrder = {
            id: result.order.id,
            axieId,
            maker: result.order.maker,
            assets: result.order.assets,
            basePrice: result.order.basePrice,
            triggerPrice: triggerPrice.toString(),
            currentPrice: currentPrice.toString(),
            endedAt: result.order.endedAt,
            endedPrice: result.order.endedPrice,
            expiredAt: result.order.expiredAt,
            startedAt: result.order.startedAt,
            nonce: result.order.nonce,
            signature: result.order.signature
          }

          // call the hardhart task buy with the order as argument
          const tx: string = await run('buy', { order: JSON.stringify(order) })
          console.log(`--tx ${tx}`)
          const txLink = `https://explorer.roninchain.com/tx/${tx}`

          // send a message to the discord channel if we've defined one
          if (process.env.BOT_CHANNEL_ID !== undefined) {
            await DiscordRequest(`/channels/${process.env.BOT_CHANNEL_ID}/messages`, {
              method: 'POST',
              body:
            {
              embeds: [{
                title: `Market order ${order.id} for axie ${axieId} triggered`,
                description: `tx: ${txLink}`
              }]
            }
            })
          }
        }
      }
    }
  } catch (error) {
    console.log(error)
    // todo: re create order if tx fails, or retry with the next result
  }
}
