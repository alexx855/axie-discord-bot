/* eslint-disable @typescript-eslint/no-misused-promises */
import { AXIE_COMMAND, GET_ORDERS_COMMAND, REMOVE_ORDER_COMMAND, ADD_ORDER_COMMAND } from './constants'
import express from 'express'
import {
  InteractionType,
  InteractionResponseType,
  MessageComponentTypes
} from 'discord-interactions'
import {
  MarketPropsInterface,
  IMarketOrder,
  VerifyDiscordRequest,
  getMarketOrders,
  setMarketOrders,
  fetchMarketResultsByOrder,
  removeMarketOrder,
  addMarketOrder,
  DiscordRequest,
  HasGuildCommands
} from './utils'
import { ethers } from 'ethers'
import { run, userConfig } from 'hardhat'
import * as dotenv from 'dotenv'
dotenv.config()

const networks = userConfig.networks as any
const url = networks?.ronin?.url as string
const provider = new ethers.providers.JsonRpcProvider(
  url,
  networks?.ronin?.chainId
)

// Create an express app
const app = express()
// Get port, or default to 3000
const PORT = process.env.PORT ?? 3000
// Parse request body and verifies incoming requests using discord-interactions package
console.log('Verifying requests', process.env.PUBLIC_KEY ?? '')
app.use(
  express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY ?? '') })
)

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async (req, res) => {
  // Interaction type and data
  const { type, data } = req.body

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG })
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data
    console.log(data)
    // const userId = data.member.user.id
    console.log('Command name:', name)

    // data.guild_id

    if (name === 'get_orders') {
      const userId: string = req.body.member.user.id

      // todo: validate user id, it should be admin
      console.log('User ID:', userId)

      // Get orders from redis
      const orders = await getMarketOrders()
      let content = ''

      if (orders.length > 0) {
        console.log('orders', orders)
        content = `<@${userId}> has the following open order${orders.length > 1 ? 's' : ''} :\r\n`

        for (const order of orders) {
          content = content + 'Order ' + order.id.toString() + '\nTrigger price: ' + order.triggerPrice.toString() + ' \n'
          // add show original props
          content = content + order.marketUrl + '\n'
          // add a separator line, if not the last order
          if (order !== orders[orders.length - 1]) {
            content = content + '------------------------\r\n'
          }
        }
      } else {
        content = `<@${userId}> you have no orders.\nUse **/add_order** to add one.`
      }

      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content
        }
      })
    }

    if (name === 'remove_order') {
      // Get orders date from options value, it's the id of the order, shame on me (┬┬﹏┬┬)
      const orderDate = data.options[0].value as string
      // Default response
      let content = `Order ${orderDate} not found`
      // Check if order exists, get current orders list
      const orders = await getMarketOrders()
      // Check if order exists
      const orderIndex = orders.findIndex(
        (order) => order.id.toString() === orderDate
      )
      if (orderIndex !== -1) {
        // Remove the order
        orders.splice(orderIndex, 1)
        // Save orders
        await setMarketOrders(orders)
        // Set content
        content = `Order ${orderDate} removed`
      }
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content
        }
      })
    }

    if (data.name === 'add_order') {
      // todo: check if user can add order

      // Send a modal as response
      return res.send({
        type: InteractionResponseType.APPLICATION_MODAL,
        data: {
          custom_id: 'add_order_modal',
          title: 'Modal title',
          components: [
            {
              // Text inputs must be inside of an action component
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  // See https://discord.com/developers/docs/interactions/message-components#text-inputs-text-input-structure
                  type: MessageComponentTypes.INPUT_TEXT,
                  custom_id: 'market_props',
                  style: 1,
                  label: 'Market filter props from the URL'
                }
              ]
            },
            {
              // Text inputs must be inside of an action component
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  // See https://discord.com/developers/docs/interactions/message-components#text-inputs-text-input-structure
                  type: MessageComponentTypes.INPUT_TEXT,
                  custom_id: 'market_trigger_price',
                  style: 1,
                  label: 'Market Trigger Price'
                }
              ]
            }
          ]
        }
      })
    }

    // If command is not recognized, send an error message
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Unknown command'
      }
    })
  }

  /**
   * Handle modal submissions
   */
  if (type === InteractionType.APPLICATION_MODAL_SUBMIT) {
    // custom_id of modal
    const modalId = data.custom_id
    // user ID of member who filled out modal
    const userId = req.body.member.user.id

    if (modalId === 'add_order_modal') {
      let modalValues = ''
      // Get value of text inputs
      for (const action of data.components) {
        const inputComponent = action.components[0]
        modalValues += `${inputComponent.custom_id as string}: ${inputComponent.value as string
          }\n`
      }

      // get market props from modal, it's the market url ej: https://app.axieinfinity.com/marketplace/axies/?class=Plant&part=ears-sakura&part=mouth-silence-whisper&part=horn-strawberry-shortcake&auctionTypes=Sale
      const marketPropsFromModal = data.components[0].components[0].value as string
      const marketUrl = marketPropsFromModal
      // convert to params, split ? and &
      const marketPropsArray = marketPropsFromModal.replace(
        'https://app.axieinfinity.com/marketplace/axies/',
        ''
      ).split('?')[1]?.split('&')

      // group the same props by key, keep values
      const marketPropsGrouped: MarketPropsInterface =
          marketPropsArray.reduce((acc: any, curr) => {
            const [key, value] = curr.split('=')
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (acc[key] && !acc[key].includes(value)) {
              acc[key].push(value)
            } else {
              acc[key] = [value]
            }
            return acc
          }, {})

      // // todo: check if the props are valid, create interface for props
      // if (marketPropsArray.length === 0) {
      //   return res.send({
      //     type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      //     data: {
      //       content: 'Invalid market props'
      //     }
      //   })
      // }

      // get and parse trigger price
      const priceFromModal = ethers.utils.parseUnits(data.components[1].components[0].value, 'ether')
      // todo: validate price
      if (!priceFromModal._isBigNumber) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Invalid price'
          }
        })
      }

      // create the new market order
      const newOrder: IMarketOrder = {
        id: Date.now(), // todo: use a real id generator
        userId,
        marketUrl,
        marketProps: marketPropsGrouped,
        triggerPrice: ethers.utils.formatEther(priceFromModal)
      }

      // save to redis
      try {
        await addMarketOrder(newOrder)
      } catch (error) {
        console.log(error)
      }

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `<@${userId as string
            }> created the following order:\n\n${modalValues}`
        }
      })
    }
  }

  /**
   * Handle requests from interactive components
   * See https://discord.com/developers/docs/interactions/message-components#responding-to-a-component-interaction
   */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
  }
})

app.listen(PORT, async () => {
  console.log('Listening on port', PORT)

  // Check if guild commands are installed (if not, install them)
  HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
    AXIE_COMMAND,
    GET_ORDERS_COMMAND,
    REMOVE_ORDER_COMMAND,
    ADD_ORDER_COMMAND
  ])

  // get first account from the network list, ref: hardhat.config.ts
  const wallet = new ethers.Wallet(networks.ronin.accounts[0], provider)
  const address = await wallet.getAddress()
  // get account balance
  const balance = await provider.getBalance(address)
  const balanceInEther = ethers.utils.formatEther(balance)
  console.log(`RON balance: ${balanceInEther}`)

  // track time, some blocks came almost at the same time
  let time = Date.now()
  const onBlockFetch = async (blockNumber: number): Promise<void> => {
    try {
      const diff = Date.now() - time
      time = Date.now()

      // we got two block at the same time, skip this one
      if (diff <= 1000) {
        return
      }

      // todo: add env var to enable/disable this dev logs
      console.log(`new block ${blockNumber} received after ${diff}ms`)

      // get orders from redis
      const marketOrders = await getMarketOrders()

      if (marketOrders.length > 0) {
        for (let i = 0; i < marketOrders.length; i++) {
          const marketOrder = marketOrders[i]
          // console.log('marketOrder', marketOrder)
          console.log(`checking order ${marketOrder.id} for user ${marketOrder.userId}`)

          // track order time
          const orderTime = Date.now()
          // get orders matches from Axies listing based on the given order
          const results = await fetchMarketResultsByOrder(marketOrder)

          // check time, if the order is older than 3 seconds, skip it
          const orderTimeDiff = Date.now() - orderTime
          if (orderTimeDiff > 3000) {
            console.log(`order too old, skip it (${orderTimeDiff}ms)`)
            continue
          }
          if (results.length > 0) {
            console.log('  results', results)

            // remove the market order from the orders array, to prevent it from being executed again
            await removeMarketOrder(marketOrder.id)

            // get only the first order, it should be the chepeast one
            const order = results[0]
            // call the hardhart task buy the, with the order as argument
            const tx = await run('buy', { order })
            console.log('tx', tx)
            const txLink = `https://explorer.roninchain.com/tx/${tx as string}`

            // todo: validate that we're the owners of the axie now, with a rpc call to the contract
            // todo: generate and send an img of the axie

            // send a message to the channel
            const endpoint = `/channels/${process.env.BOT_CHANNEL_ID as string}/messages`
            await DiscordRequest(endpoint, {
              method: 'POST',
              body:
              {
                embeds: [{
                  title: `Market order ${marketOrder.id} completed`,
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

  provider.on('block', onBlockFetch)
})

app.get('/', async (req, res) => {
  res.send('hello discord bot!')
})

app.get('/terms-of-service', (req, res) => {
  // TODO: Add terms of service, discord requires it for the authorized application
  res.send('Terms of Service')
})

app.get('/privacy-policy', (req, res) => {
  // TODO: Add privacy policy, discord requires it for the authorized application
  res.send('Privacy Policy')
})
