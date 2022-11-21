import { run } from 'hardhat'
import { getMarketOrders, fetchMarketByOrder, removeMarketOrder } from './market'
import { DiscordRequest } from './utils'

export const onBlock = async (blockNumber: number): Promise<void> => {
  // track time, some blocks came almost at the same time
  try {
    // get buy   orders from redis
    const marketOrders = await getMarketOrders()

    if (marketOrders.length > 0) {
      for (let i = 0; i < marketOrders.length; i++) {
        const marketOrder = marketOrders[i]
        // console.log('marketOrder', marketOrder)
        console.log(`checking order ${marketOrder.id} for user ${marketOrder.userId}`)

        // track order time
        const orderTime = Date.now()
        // get orders matches from Axies listing based on the given order
        const results = await fetchMarketByOrder(marketOrder)

        // check time, if the order is older than 3 seconds, skip it
        const orderTimeDiff = Date.now() - orderTime
        if (orderTimeDiff > 3000) {
          console.log(`order too old, skip it (${orderTimeDiff}ms)`)
          continue
        }

        if (results.length > 0) {
          // get only the first order, it should be the chepeast one
          const order = results[0]

          // remove the market order from the orders array, to prevent it from being executed again
          await removeMarketOrder(marketOrder.id)

          // call the hardhart task buy the, with the order as argument
          const tx: string = await run('buy', { order: JSON.stringify(order) })
          const txLink = `https://explorer.roninchain.com/tx/${tx}`

          // send a message to the channel
          const endpoint = `/channels/${process.env.BOT_CHANNEL_ID as string}/messages`
          await DiscordRequest(endpoint, {
            method: 'POST',
            body:
            {
              embeds: [{
                title: `Market order ${marketOrder.id} triggered`,
                description: txLink
              }]
            }
          })
        }
      }
    }

    // todo: get latest sales from api and save it to postgres
  } catch (error) {
    console.log(error)
  }
}
