import { ethers } from 'ethers'
import { run } from 'hardhat'
import { buyAxie, getAxieTransferHistory, getClassColor } from '../axies'
import { IScalpedAxie, ICriteria, IMarketBuyOrder } from '../interfaces'
import { fetchMarketRecentlistings, fetchMarketByCriteria, getLastestAxieListingId, setMostRecentlistingAxieId } from '../market'
import { DiscordRequest, getFloorPrice } from '../utils'
import discordOrdersTicker from './discordOrdersTicker'

const AUTO_BUY_FLOOR = false // set to true to auto buy axies at floor price
const MIN_PROFIT = ethers.utils.parseUnits('0.001', 'ether') // the minimum profit , in ETH, to consider buy an axie
const AUTO_BUY_MAX_PRICE = ethers.utils.parseUnits('0.002', 'ether') // the max price to auto buy a floor axie, in ETH, if all the conditions are met
const MAX_PRICE = ethers.utils.parseUnits('10.02', 'ether') // the max willing to pay per axie, in ETH, just a safe to avoid buy expensive axies
const MIN_PROFIT_EST_PERCENTAGE = 40 // the minimum difference in % on the floor price to consider buy an axie
const MAX_BREEDS = 2 // the maximum number of breeds to consider buy an axie
const MIN_PURENESS = 4 // the minimum pureness to consider buy an axie, les than 4 is considered a TUTIFRUTI 😂
const MAX_SIMILAR = 40 // the maximun number on sale to consider buy an axie
const MIN_SIMILAR = 3 // the minimum number on sale to consider buy an axie
const MAX_EXISTENCE = 500 // the maximun number of similar on existence to consider buy an axie
const MIN_EXISTENCE = 3 // the minimum number of similar on existence to consider buy an axie

// this script will check for the latest axies listings at the marketplace and look for axies that meet the criteria
const marketRecentListingsTicker = async () => {
  try {
    // get latest market listings from api
    const listings = await fetchMarketRecentlistings()
    if (listings === false) {
      // console.log('\x1b[91m%s\x1b[0m', 'error fetching latest listings')
      return
    }

    // get lastest axie id from redis
    const lastestAxieListingId = await getLastestAxieListingId()

    // check if its still the most recent, if so, return
    if (lastestAxieListingId === listings[0].id) {
      return
    }

    // save the most recent listings id to redis
    await setMostRecentlistingAxieId(listings[0].id)

    // interate over the listings and check if there is any axie that meets the criteria
    const items: IScalpedAxie[] = []
    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i]
      if (listing.id === lastestAxieListingId) {
        continue
      }

      let lastSoldDate,
        lastSoldPrice

      // get the last sold price from the similar Axie's listing history
      const transferHistoryData = await getAxieTransferHistory(listing.id)
      if (transferHistoryData !== null && transferHistoryData.transferHistory.results.length > 0) {
        const transferHistory = transferHistoryData.transferHistory
        const sDate = new Date(transferHistory.results[0].timestamp * 1000)
        lastSoldDate = sDate.toLocaleString()
        const sPrice = ethers.BigNumber.from(transferHistory.results[0].withPrice)
        lastSoldPrice = sPrice.toString()
      }

      // check if the axie is under the max price willing to pay
      const currentPrice = ethers.BigNumber.from(listing.order.currentPrice)
      if (currentPrice.gt(MAX_PRICE)) {
        console.log(`skiping ${listing.id} price Ξ${ethers.utils.formatEther(currentPrice)} is over Ξ${ethers.utils.formatEther(MAX_PRICE)}`)
        continue
      }

      // check if the axie has less than the max number of breeds
      if (listing.breedCount > MAX_BREEDS) {
        console.log(`skiping ${listing.id} has ${listing.breedCount} breeds and is over ${MAX_BREEDS}`)
        continue
      }

      // pureness is the max number of parts that are the same class, if its the same class as the axie, multiply its pureness points by 2
      const pureness = listing.parts.reduce((acc, part) => {
        if (part.class === listing.class) {
          return acc + 2
        }
        return acc + 1
      }, 0)

      if (pureness < MIN_PURENESS) {
        console.log(`skiping ${listing.id} has ${pureness} pureness and is under ${MIN_PURENESS}`)
        continue
      }

      // auto buy axies that are under floor price
      const floorPrice = await getFloorPrice()
      if (AUTO_BUY_FLOOR && floorPrice !== null && currentPrice.lt(floorPrice) && currentPrice.lt(AUTO_BUY_MAX_PRICE)) {
        console.log('\x1b[33m%s\x1b[0m', `Auto buying ${listing.id} price Ξ${ethers.utils.formatEther(currentPrice)} is under Ξ${ethers.utils.formatEther(floorPrice)}`)

        const axieId = listing.order.assets[0].id as string
        const order: IMarketBuyOrder = {
          id: listing.order.id,
          axieId,
          maker: listing.order.maker,
          assets: listing.order.assets,
          basePrice: listing.order.basePrice,
          currentPrice: currentPrice.toString(),
          endedAt: listing.order.endedAt.toString(),
          endedPrice: listing.order.endedPrice,
          expiredAt: listing.order.expiredAt.toString(),
          startedAt: listing.order.startedAt.toString(),
          nonce: listing.order.nonce,
          signature: listing.order.signature
        }

        // buy the axie
        await buyAxie(async () => await run('buy', { order: JSON.stringify(order) }), order).catch((err) => {
          console.log('\x1b[91m%s\x1b[0m', `error buying axie ${order.axieId} `)
          console.log(err)
        })

        break
      }

      // check if the axie has less than the max number on sale
      const criteria: ICriteria = {
        classes: [listing.class],
        parts: listing.parts.map((part) => part.id)
      }
      const similarMarketListings = await fetchMarketByCriteria(
        criteria,
        0,
        100,
        'PriceAsc',
        'Sale'
      )

      // ?? maybe i can just get the total from rpc instead to save an api request
      const similarAxies = await fetchMarketByCriteria(
        criteria
      )

      if (similarMarketListings === false || similarAxies === false) {
        throw new Error('error fetching API')
      }

      const totalOnSale = similarMarketListings.total - 1 // -1 to exclude the current listing
      // check if the axie has less than the max number on sale
      if (totalOnSale > MAX_SIMILAR || totalOnSale < MIN_SIMILAR) {
        console.log(`skiping ${listing.id} has ${totalOnSale} similar on sale and is over ${MAX_SIMILAR} or under ${MIN_SIMILAR}`)
        continue
      }

      // check if the axie has less than the max number on existence
      const totalAxies = similarAxies.total
      if (totalAxies > MAX_EXISTENCE || totalAxies < MIN_EXISTENCE) {
        console.log(`skiping ${listing.id} has ${totalAxies} similar on existence and is over ${MAX_EXISTENCE} or under ${MIN_EXISTENCE}`)
        continue
      }

      // similar listings excluding the current one
      const similarListings = similarMarketListings.results.filter((axie) => {
        return axie.id !== listing.id
      })

      const similarFloorPrice = ethers.BigNumber.from(similarListings[0].order.currentPrice)
      // check if the similar floor price - current price is more than the min profit
      const estProfit = similarFloorPrice.sub(currentPrice)
      console.log(`est profit Ξ${ethers.utils.formatEther(estProfit)}`)

      if (estProfit.lt(MIN_PROFIT)) {
        console.log(`skiping ${listing.id} profit Ξ${ethers.utils.formatEther(estProfit)} is under Ξ${ethers.utils.formatEther(MIN_PROFIT)}`)
        continue
      }

      // rarity based on the Axie's R1 genes
      const rarity = totalAxies === 1 ? 'Unique' : totalAxies < 100 ? 'Epic' : totalAxies < 1000 ? 'Rare' : 'Common'

      // check if the minimum difference in % on the floor price to consider buy an axie
      const estimatedPercentage = estProfit.div(currentPrice).toNumber() * 100
      if (estimatedPercentage < MIN_PROFIT_EST_PERCENTAGE) {
        console.log(`skiping ${listing.id} estimated percentage ${estimatedPercentage}% is under ${MIN_PROFIT_EST_PERCENTAGE}%`)
        continue
      }

      items.push({
        axieId: listing.id,
        currentPrice: currentPrice.toString(),
        floorPrice: similarFloorPrice.toString(),
        profit: estProfit.toString(),
        estimatedPercentage,
        breedCount: listing.breedCount,
        class: listing.class,
        parts: listing.parts,
        rarity,
        pureness,
        totalOnSale,
        totalAxies,
        lastSoldDate,
        lastSoldPrice
      })
    }

    // send discord message
    if (items.length > 0 && process.env.DISCORD_WEBHOOK_URL !== undefined) {
      console.log('\x1b[33m%s\x1b[0m', 'Recent listing met the criteria')

      // create embed array with the scalped data
      const embeds = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const color = getClassColor(item.class)
        const fields = [
          {
            name: 'Breeds',
            value: item.breedCount,
            inline: true
          },
          {
            name: 'On Market',
            value: item.totalOnSale,
            inline: true
          },
          {
            name: 'In Existence',
            value: item.totalAxies,
            inline: true
          },
          {
            name: 'Parts',
            value: item.parts.map((part) => `${part.id} (${part.class})`).join(', '),
            inline: false
          },
          {
            name: 'Axie URL',
            value: `https://app.axieinfinity.com/marketplace/axies/${item.axieId}`,
            inline: false
          },
          {
            name: 'Similar URL',
            value: `https://app.axieinfinity.com/marketplace/axies/?auctionTypes=Sale&parts=${item.parts.map(part => part.id).join('&parts=')}&classes=${item.class}`,
            // &breedCount=0&breedCount=${item.breedCount}
            inline: false
          }
        ]

        if (item.lastSoldDate !== undefined && item.lastSoldPrice !== undefined) {
          fields.push({
            name: 'Sale history',
            value: `Last sold: ${item.lastSoldDate}\nPrice: ${ethers.utils.formatEther(item.lastSoldPrice).slice(0, 6)}Ξ`,
            inline: true
          })
        }

        embeds.push(
          {
            title: `${item.rarity} ${item.class.toLowerCase()} ${item.estimatedPercentage}% flip chance`,
            description: `Price:${ethers.utils.formatEther(item.currentPrice).slice(0, 6)}Ξ\nFloor: ${ethers.utils.formatEther(item.floorPrice).slice(0, 6)}Ξ\nEst. Profit: ${ethers.utils.formatEther(item.profit).slice(0, 6)}Ξ`,
            color,
            thumbnail: {
              url: `https://axiecdn.axieinfinity.com/axies/${item.axieId}/axie/axie-full-transparent.png`
            },
            fields
          })
      }
      void DiscordRequest(`/channels/${process.env.BOT_CHANNEL_ID}/messages`, {
        method: 'POST',
        body: {
          content: 'Recent listing met the criteria',
          embeds
        }
      })
    }
  } catch (error) {
    console.log(error)
    throw error
  }
}

export default marketRecentListingsTicker
