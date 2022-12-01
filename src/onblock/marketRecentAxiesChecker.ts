import { ethers } from 'ethers'
import { IScalpedAxie, ICriteria } from '../interfaces'
import { fetchMarketRecentlistings, getMostRecentlistingsAxieId, setMostRecentlistingsAxieId, fetchMarketByCriteria } from '../market'
import { getClassColor, DiscordRequest } from '../utils'

const MAX_PRICE = ethers.utils.parseUnits('0.1', 'ether') // the max willing to pay per axie, in ETH, just a safe to avoid buy expensive axies that wont sell for a while
const MAX_SIMILAR = 40 // the maximun number on sale to consider buy an axie
const MIN_SIMILAR = 3 // the minimum number on sale to consider buy an axie
const MIN_PROFIT = ethers.utils.parseUnits('0.004', 'ether') // the minimum profit , in ETH
const MIN_PROFIT_DIFF_PERCENTAGE = 10 // the minimum difference in % on the floor price to consider buy an axie
const MAX_BREEDS = 2 // the maximum number of breeds to consider buy an axie
const MIN_PURENESS = 4 // the minimum pureness to consider buy an axie, les than 4 is considered a TUTIFRUTI 😂

// TODO:
// const MAX_EXISTENCE = 500 // the maximun number of similar on existence to consider buy an axie
// const MIN_EXISTENCE = 3 // the minimum number of similar on existence to consider buy an axie
// const AUTO_BUY_PRICE = ethers.utils.parseUnits('0.01', 'ether') // the price to auto buy the axie, in ETH, if all the conditions are met
// const NOTIFY_UNIQUES = true // if true, it will notify about unique axies that meet the criteria (MAX_PRICE,MAX_BREEDS,MIN_PURENESS)

// this script will check for the latest axies listings at the marketplace and look for axies that meet the criteria
const marketRecentAxiesChecker = async (blockNumber: number) => {
  try {
    // get latest market listings from api
    const listings = await fetchMarketRecentlistings()
    if (listings === false) {
      // console.log('\x1b[91m%s\x1b[0m', 'error fetching latest listings')
      throw new Error('error fetching API')
    }

    // get last axie id from redis
    const mostRecentSavedAxieId = await getMostRecentlistingsAxieId()

    // check if its still the most recent
    if (mostRecentSavedAxieId === listings[0].id) {
      return
    }

    // save the most recent listings id to redis
    void setMostRecentlistingsAxieId(listings[0].id)

    // interate over the listings and check if there is an scalper
    const items: IScalpedAxie[] = []
    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i]
      if (listing.id === mostRecentSavedAxieId) {
        break
      }
      // console.log(`checking axie ${listing.id}`)

      // check if the axie is under the max price willing to pay
      const currentPrice = ethers.BigNumber.from(listing.order.currentPrice)
      if (currentPrice.gt(MAX_PRICE)) {
        // console.log(`skiping ${listing.id} price Ξ${ethers.utils.formatEther(currentPrice)} is over Ξ${ethers.utils.formatEther(MAX_PRICE)}`)
        continue
      }

      // check if the axie has less than the max number of breeds
      if (listing.breedCount > MAX_BREEDS) {
        // console.log(`skiping ${listing.id} has ${listing.breedCount} breeds and is over ${MAX_BREEDS}`)
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
        // console.log(`skiping ${listing.id} has ${pureness} pureness and is under ${MIN_PURENESS}`)
        continue
      }

      // check if the axie has less than the max number on sale
      const criteria: ICriteria = {
        classes: [listing.class],
        parts: listing.parts.map((part) => part.id)
        // todo: fix breeding count results
        // breedCount: [listing.breedCount]
      }
      const similarMarketListings = await fetchMarketByCriteria(
        criteria,
        0,
        100,
        'PriceAsc',
        'Sale'
      )

      // ?? maybe just get the total from rpc instead to save an api request
      const similarAxies = await fetchMarketByCriteria(
        criteria
      )

      if (similarMarketListings === false || similarAxies === false) {
        throw new Error('error fetching API')
      }

      // limited to 100 listings per request
      const results = similarMarketListings.results
      let from = 0
      if (similarMarketListings.total > 100) {
        const total = similarMarketListings.total
        while (total > results.length) {
          from += 100
          const res = await fetchMarketByCriteria(
            criteria,
            from,
            100,
            'Latest',
            'Sale'
          )

          if (res !== false) {
            results.push(...res.results)
          }

          // await some time to avoid rate limit
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      const totalAxies = similarAxies.total
      // const rateListed = totalOnSale / totalAxies
      // console.log(totalAxies, totalOnSale, rateListed)

      // get floor price from on sale, excluding the current listing
      const similarListings = similarMarketListings.results.filter((axie) => {
        return axie.id !== listing.id
      })
      // const totalOnSale = similarListings.length
      const totalOnSale = similarMarketListings.total - 1 // -1 to exclude the current listing

      if (totalOnSale > MAX_SIMILAR || totalOnSale < MIN_SIMILAR) {
        // console.log(`skiping ${listing.id} has ${totalOnSale} similar on sale and is over ${MAX_SIMILAR} or under ${MIN_SIMILAR}`)
        continue
      }

      const floorPrice = ethers.BigNumber.from(similarListings[0].order.currentPrice)
      // check if the similar floor price - current price is more than the min profit
      const profit = floorPrice.sub(currentPrice)
      if (profit.lt(MIN_PROFIT)) {
        // console.log(`skiping ${listing.id} profit Ξ${ethers.utils.formatEther(profit)} is under Ξ${ethers.utils.formatEther(MIN_PROFIT)}`)
        continue
      }

      // rarity based on the Axie's R1 genes
      const rarity = totalAxies === 1 ? 'Unique' : totalAxies < 100 ? 'Epic' : totalAxies < 1000 ? 'Rare' : 'Common'

      // check if the minimum difference in % on the floor price to consider buy an axie
      const estimatedPercentage = profit.div(currentPrice).toNumber() * 100
      if (estimatedPercentage < MIN_PROFIT_DIFF_PERCENTAGE) {
        // console.log(`skiping ${listing.id} estimated percentage ${estimatedPercentage}% is under ${MIN_PROFIT_DIFF_PERCENTAGE}%`)
        continue
      }

      // todo: get the last sold price from the similar Axie's listing history
      // const lastSoldDate = null
      // const lastSoldPrice = null

      items.push({
        axieId: listing.id,
        currentPrice: currentPrice.toString(),
        floorPrice: floorPrice.toString(),
        profit: profit.toString(),
        estimatedPercentage,
        breedCount: listing.breedCount,
        class: listing.class,
        parts: listing.parts,
        rarity,
        pureness,
        totalOnSale,
        totalAxies
      })
    }

    // send discord message with the scalper found
    if (items.length > 0) {
      console.log('\x1b[33m%s\x1b[0m', 'The scalper found something new...')
      console.log(items)

      if (process.env.BOT_CHANNEL_ID === undefined) {
        console.log('BOT_CHANNEL_ID not set')
        return
      }

      // create embed array with the scalper data
      const embeds = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const color = getClassColor(item.class)
        embeds.push(
          {
            title: `${item.rarity} ${item.class.toLowerCase()} ${item.estimatedPercentage}% flip chance`,
            description: `Price:${ethers.utils.formatEther(item.currentPrice).slice(0, 6)}Ξ\nFloor: ${ethers.utils.formatEther(item.floorPrice).slice(0, 6)}Ξ\nEst. Profit: ${ethers.utils.formatEther(item.profit).slice(0, 6)}Ξ`,
            color,
            thumbnail: {
              url: `https://axiecdn.axieinfinity.com/axies/${item.axieId}/axie/axie-full-transparent.png`
            },
            fields: [
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
                value: `https://marketplace.axieinfinity.com/axie/${item.axieId}`,
                inline: false
              },
              {
                name: 'Similar URL',
                value: `https://app.axieinfinity.com/marketplace/axies/?auctionTypes=Sale&parts=${item.parts.map(part => part.id).join('&parts=')}&classes=${item.class}`,
                // &breedCount=0&breedCount=${item.breedCount}
                inline: false
              }
              // {
              //   name: 'Sale history',
              //   value: item.lastSoldPrice,
              //   inline: true
              // }
            ]
          })
      }
      void DiscordRequest(`/channels/${process.env.BOT_CHANNEL_ID}/messages`, {
        method: 'POST',
        body:
        {
          content: 'The scalper found something new...',
          embeds
        }
      })
    }
  } catch (error) {
    console.log(error)
    throw error
  }
}

export default marketRecentAxiesChecker
