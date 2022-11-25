import { ethers } from 'ethers'
import { ICriteria } from './interfaces'
import { fetchMarketByCriteria, fetchMarketRecentlistings, getMostRecentlistingsAxieId, setMostRecentlistingsAxieId } from './market'
import { DiscordRequest, getClassColor } from './utils'

interface IAxieOpportunityItem {
  axieId: string
  class: string
  parts: Array<{
    id: string
    name: string
    class: string
    type: string
  }>
  currentPrice: string
  floorPrice: string
  profit: string
  breedCount: number
  totalListed: number
  totalAxies: number
  estimatedPercentage: number
  rarity: 'common' | 'rare' | 'epic' | 'unique'
  // pureness: number
  // similarFloorPrice: string
  // similarListings: number
  // similarLastSoldDate: string
}

const MAX_PRICE = ethers.utils.parseUnits('0.1', 'ether') // the max price to buy an axie, in ETH
const MAX_SIMILAR = 200 // the maximun number of similar listings to consider buy an axie
const MIN_SIMILAR = 4 // the minimum number of similar listings to consider buy an axie
const MIN_PROFIT = ethers.utils.parseUnits('0.004', 'ether') // the minimum profit to buy an axie, in ETH
const MIN_PROFIT_DIFF_PERCENTAGE = 120 // the minimum difference in % on the floor price to consider buy an axie
const MAX_BREEDS = 2 // the maximum number of breeds to consider buy an axie
// const MIN_PURENESS = 4 // the minimum pureness to consider buy an axie, les than 4 is considered a TUTIFRUTI 😂
// const MAX_EXISTENCE = 40 // the maximun number of similar on existence to consider buy an axie
// const BUY_UNIQUES = false // if true, it will AUTOAMTICALLY buy any unique axies that meet the criteria (MAX_PRICE,MAX_BREEDS,MIN_PURENESS)
// const NOTIFY_UNIQUES = true // if true, it will notify about unique axies that meet the criteria (MAX_PRICE,MAX_BREEDS,MIN_PURENESS)

// this script will check for the latest listings at the marketplace and compare them with the orders on the market
export const opportunityChecker = async () => {
  // track time
  const startTime = Date.now()
  // console.log('\x1b[36m%s\x1b[0m', 'opportunity checking started')

  // get latest listings from api
  const listings = await fetchMarketRecentlistings()
  if (listings === false) {
    console.log('\x1b[91m%s\x1b[0m', 'error fetching latest listings')
    return
  }

  // check if there are any new orders
  if (listings[0].id === undefined) {
    console.log('\x1b[91m%s\x1b[0m', 'no axie ids found')
    return
  }

  // get last axie id from redis
  const mostRecentSavedAxieId = await getMostRecentlistingsAxieId()
  // console.log('mostRecentSavedAxieId', mostRecentSavedAxieId)

  // check if its still the most recent, if not, save it
  if (mostRecentSavedAxieId === listings[0].id) {
    console.log('\x1b[36m%s\x1b[0m', 'opportunity checking finished, no new listings')
    return
  }
  await setMostRecentlistingsAxieId(listings[0].id)

  // interate over the listings and check if there is an opportunity
  const items: IAxieOpportunityItem[] = []
  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]
    // console.log('listing', listing)
    if (listing.id === mostRecentSavedAxieId) {
      break
    }
    console.log(`checking axie ${listing.id}`)

    // check if the axie is under the max price willing to pay
    const currentPrice = ethers.BigNumber.from(listing.order.currentPrice)
    // console.log(currentPrice.toString(), MAX_PRICE.toString())
    if (currentPrice.gt(MAX_PRICE)) {
      console.log(`skiping ${listing.id} price Ξ${ethers.utils.formatEther(currentPrice)} is over Ξ${ethers.utils.formatEther(MAX_PRICE)}`)
      continue
    }

    // check if the axie has less than the max number of breeds
    // console.log(listing.breedCount, MAX_BREEDS)
    if (listing.breedCount > MAX_BREEDS) {
      console.log(`skiping ${listing.id} has ${listing.breedCount} breeds and is over ${MAX_BREEDS}`)
      continue
    }

    // todo: fix, check for all classes not only the listing class
    // check if the axie has more than the min number of pureness
    // const pureness = listing.parts.filter((part: any) => part.class === listing.class).length
    // if (pureness < MIN_PURENESS) {
    //   console.log(pureness, MIN_PURENESS)
    //   console.log(`skiping ${listing.id} has ${pureness} pureness and is under ${MIN_PURENESS}`)
    //   continue
    // }

    // check if the axie has less than the max number of similar listings
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
    const similarAxies = await fetchMarketByCriteria(
      criteria
    )

    if (similarMarketListings === false || similarAxies === false) {
      console.log('\x1b[91m%s\x1b[0m', 'error fetching similar listings')
      return
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
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    const totalAxies = similarAxies.total
    // const rateListed = totalListed / totalAxies
    // console.log(totalAxies, totalListed, rateListed)

    // get floor price from similar listings, excluding the current listing
    const similarListings = similarMarketListings.results.filter((axie) => {
      return axie.id !== listing.id
    })
    // const totalListed = similarListings.length
    const totalListed = similarMarketListings.total - 1 // -1 to exclude the current listing
    if (totalListed === 0) {
      console.log(`skiping ${listing.id} has no similar listings`)
      continue
    }

    // console.log('floorPrice', ethers.utils.formatEther(floorPrice))
    if (totalListed > MAX_SIMILAR || totalListed < MIN_SIMILAR) {
      console.log(`skiping ${listing.id} has ${totalListed} similar listings and is over ${MAX_SIMILAR} or under ${MIN_SIMILAR}`)
      continue
    }

    const floorPrice = ethers.BigNumber.from(similarListings[0].order.currentPrice)
    // check if the similar floor price - current price is more than the min profit
    const profit = floorPrice.sub(currentPrice)
    if (profit.lt(MIN_PROFIT)) {
      console.log(`skiping ${listing.id} profit Ξ${ethers.utils.formatEther(profit)} is under Ξ${ethers.utils.formatEther(MIN_PROFIT)}`)
      continue
    }

    // rarity based on the Axie's R1 genes
    const rarity = totalAxies === 1 ? 'unique' : totalAxies < 100 ? 'epic' : totalAxies < 1000 ? 'rare' : 'common'

    // check if the minimum difference in % on the floor price to consider buy an axie
    const estimatedPercentage = profit.div(currentPrice).toNumber() * 100
    if (estimatedPercentage < MIN_PROFIT_DIFF_PERCENTAGE) {
      console.log(`skiping ${listing.id} estimated percentage ${estimatedPercentage}% is under ${MIN_PROFIT_DIFF_PERCENTAGE}%`)
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
      totalListed,
      totalAxies
    })
  }

  // send discord message with the opportunity found
  if (items.length > 0) {
    console.log('\x1b[33m%s\x1b[0m', 'New profit opportunity')
    console.log(items)

    if (process.env.BOT_CHANNEL_ID === undefined) {
      console.log('BOT_CHANNEL_ID not set')
      return
    }

    // create embed array with the opportunity data
    const embeds = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const color = getClassColor(item.class)
      embeds.push(
        {
          title: `New ${item.rarity} ${item.class.toLowerCase()} ${item.estimatedPercentage}% flip chance`,
          description: `Price:${ethers.utils.formatEther(item.currentPrice)}Ξ
          Floor: ${ethers.utils.formatEther(item.floorPrice)}Ξ
          Estimated Profit: ${ethers.utils.formatEther(item.profit)}Ξ`,
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
              name: 'Similar Listing',
              value: item.totalListed,
              inline: true
            },
            {
              name: 'In existence',
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
            //   name: 'Last Sold Price',
            //   value: item.lastSoldPrice,
            //   inline: true
            // },
            // {
            //   name: 'Last Sold Date',
            //   value: item.lastSoldDate,
            //   inline: true
            // }
          ]
        })
    }
    void DiscordRequest(`/channels/${process.env.BOT_CHANNEL_ID}/messages`, {
      method: 'POST',
      body:
      {
        content: `New opportunit${embeds.length > 1 ? 'ies' : 'y'} found!`,
        embeds
      }
    })
  }

  console.log('\x1b[36m%s\x1b[0m', `opportunity checking finished after ${Date.now() - startTime}ms`)
}
