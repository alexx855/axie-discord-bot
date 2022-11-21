import { ethers } from 'ethers'
import { IMarketOrder, IMarketBuyOrder, IAsset, ICriteria } from './interfaces'
import { fetchApi, redisClient } from './utils'

export async function fetchMarketByOrder(marketOrder: IMarketOrder): Promise<IMarketBuyOrder[]> {
  // console.log('fetchMarketByOrder', marketOrder)
  const marketProps = marketOrder.marketProps
  const orders: IMarketBuyOrder[] = []
  const query = `
    query GetAxieBriefList(
      $auctionType: AuctionType
      $I: AxieSearchCriteria
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

  // validate the marketProps, not the same as the graphql criteria
  const criteria: ICriteria = {}

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
  const orders = await getMarketOrders()
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
