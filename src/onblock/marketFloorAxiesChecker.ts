import { ethers } from 'ethers'
import { fetchMarketByCriteria } from '../market'
import { DiscordRequest, getFloorPrice, setFloorPrice } from '../utils'

// this script will check for the latest axies listings at the marketplace and save the floor price to redis
const marketFloorAxiesChecker = async (blockNumber: number) => {
  try {
    const marketListings = await fetchMarketByCriteria(
      {},
      0,
      24,
      'PriceAsc',
      'Sale'
    )

    if (marketListings === false) {
      return false
    }

    // get the first listing
    const listing = marketListings.results[0]
    const floorPrice = ethers.BigNumber.from(listing.order.currentPrice)
    // console.log('floorPrice', floorPrice.toString())

    // get the floor price from redis
    const prevFloorPrice = await getFloorPrice()
    if (prevFloorPrice === '0') { // unset is '0'
      await setFloorPrice(floorPrice.toString())
      return false
    }
    const pFloorPrice = ethers.BigNumber.from(prevFloorPrice)
    // console.log('prevFloorPrice', prevFloorPrice)

    // the % difference between the current floor price and the previous floor price
    const priceChanged = floorPrice.sub(pFloorPrice).div(pFloorPrice).mul(100)
    // console.log('priceChanged', priceChanged.toString())

    // if the floor price is different from the previous one, save it to redis
    if (listing.order.currentPrice !== prevFloorPrice) {
      // console log if the price increased or decreased
      if (floorPrice.gt(pFloorPrice)) {
        console.log('\x1b[102m%s\x1b[0m', `Floor price increased by ${ethers.utils.formatEther(floorPrice.sub(pFloorPrice))}`)
      } else {
        console.log('\x1b[101m%s\x1b[0m', `Floor price dumped ${ethers.utils.formatEther(pFloorPrice.sub(floorPrice))}`)
      }

      // save the new floor price to redis
      await setFloorPrice(floorPrice.toString())

      // notify discord if the price changed more than 1%
      if (priceChanged.gt(1)) {
        if (process.env.BOT_CHANNEL_ID === undefined) {
          return
        }

        void DiscordRequest(`/channels/${process.env.BOT_CHANNEL_ID}/messages`, {
          method: 'POST',
          body:
          {
            title: `New floor price: ${ethers.utils.formatEther(floorPrice)}`,
            content: `https://marketplace.axieinfinity.com/axie/${listing.id}`
          }
        })
      }
    }
  } catch (error) {
    console.log(error)
    throw error
  }
}

export default marketFloorAxiesChecker
