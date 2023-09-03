import { ethers } from 'ethers'
import { buyAxie } from './axies'
import { ICriteria, IMarketBuyOrder } from './interfaces'
import { getRedisMarketOrders, fetchMarketByCriteria, removeMarketOrder, updateMarketOrder, addMarketOrder } from './market'

const discordOrdersTicker = async (provider: ethers.providers.JsonRpcProvider, wallet: ethers.Wallet) => {
  // get buy created from discord
  const marketOrders = await getRedisMarketOrders()
  if (marketOrders.length > 0) {
    for (let i = 0; i < marketOrders.length; i++) {
      const marketOrder = marketOrders[i]

      // validate the marketProps, not the same as the graphql criteria sometimes
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
        criteria.breedCount = marketProps.breedCount?.map((item) => Number(item))
      }

      if (marketProps.pureness !== undefined) {
        // convert strings in the array to numbers
        criteria.pureness = marketProps.pureness.map((item) => Number(item))
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
      console.log(res)
      if (res === false || res.results.length === 0) {
        return false
      }

      // get the first result, the cheapest one
      const result = res.results[0]

      // save floor price if changed, maybe its an auction
      const floorPrice = ethers.utils.formatEther(result.order.currentPrice)
      if (floorPrice !== marketOrder.floorPrice) {
        marketOrder.floorPrice = floorPrice
        await updateMarketOrder(marketOrder)
      }

      const currentPrice = ethers.BigNumber.from(result.order.currentPrice)

      // check if the current price is lower than the trigger price, if so, buy the axie
      if (triggerPrice.gte(currentPrice)) {
        const axieId = result.order.assets[0].id as string
        const order: IMarketBuyOrder = {
          id: result.order.id,
          axieId,
          maker: result.order.maker,
          assets: result.order.assets,
          basePrice: result.order.basePrice,
          currentPrice: currentPrice.toString(),
          endedAt: result.order.endedAt,
          endedPrice: result.order.endedPrice,
          expiredAt: result.order.expiredAt,
          startedAt: result.order.startedAt,
          nonce: result.order.nonce,
          signature: result.order.signature
        }
        // remove the market order from the orders array, to prevent it from being executed again
        await removeMarketOrder(marketOrder.id)

        // buy the axie
        const receipt = await buyAxie(order, provider, wallet)
        // TODO: validate if tx was successful
        console.log(receipt)
        if (receipt === false) {
          // add the order back to the orders array
          await addMarketOrder(marketOrder)
        }
      }
    }
  }
}

export default discordOrdersTicker
