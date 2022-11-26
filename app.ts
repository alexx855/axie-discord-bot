import {
  AXIE_COMMAND,
  GET_ORDERS_COMMAND,
  REMOVE_ORDER_COMMAND,
  ADD_ORDER_COMMAND
} from './constants'
import express from 'express'
import {
  InteractionType,
  InteractionResponseType,
  MessageComponentTypes
} from 'discord-interactions'
import { ethers } from 'ethers'
import { getAxieEmbed } from './src/axies'
import { randomUUID } from 'crypto'
import { MarketPropsInterface, IMarketOrder } from './src/interfaces'
import { getMarketOrders, setMarketOrders, addMarketOrder } from './src/market'
import { VerifyDiscordRequest, HasGuildCommands } from './src/utils'
import { opportunityChecker } from './src/opportunity'
import { config } from 'hardhat'
import * as dotenv from 'dotenv'
dotenv.config()

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
// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.post('/interactions', async (req, res) => {
  // Interaction type and data
  const { type, data } = req.body
  console.log('Received interaction', type, data)

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
    console.log('Command name:', name)
    if (name === 'axie') {
      // Send a message into the channel where command was triggered from
      const axieId = data.options[0].value as string
      try {
        const embed = await getAxieEmbed(axieId)
        const content = embed === false ? 'Axie not found' : ''

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content,
            embeds: [embed]
          }
        })
      } catch (error) {
        console.log('Error:', error)
      }
    }

    // Check for admin, if not admin, return
    const userId: string = req.body?.member?.user?.id
    const adminId: string = process.env.DISCORD_USER_ID ?? ''
    if (userId !== adminId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Only admin'
        }
      })
    }

    if (name === 'get_orders') {
      // Get orders from redis
      const orders = await getMarketOrders()
      let content = ''

      if (orders.length > 0) {
        console.log('orders', orders)
        content = `I've the following open order${orders.length > 1 ? 's' : ''}:\r\n`

        for (const order of orders) {
          content = content + 'Order ID: **' + order.id.toString() + '**\nTrigger price: ' + order.triggerPrice.toString() + ' \n'
          content = content + order.marketUrl + '\n'
          if (order !== orders[orders.length - 1]) {
            content = content + '------------------------\r\n'
          }
        }
      } else {
        content = 'I\'ve no open orders.\nUse **/add_order** to add one.'
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
      const orderID = data.options[0].value as string
      // Default response
      let content = `Order ID: **${orderID}** not found`
      // Check if order exists, get current orders list
      const orders = await getMarketOrders()
      // Check if order exists
      const orderIndex = orders.findIndex(
        (order) => order.id.toString() === orderID
      )
      if (orderIndex !== -1) {
        // Remove the order
        orders.splice(orderIndex, 1)
        await setMarketOrders(orders)
        content = `Order ID: **${orderID}** removed`
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
      // Send a modal as response
      return res.send({
        type: InteractionResponseType.APPLICATION_MODAL,
        data: {
          custom_id: 'add_order_modal',
          title: 'Add Order',
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
    const userId = req.body.member.user.id as string

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

      // todo: check if the props are valid
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
        id: randomUUID(),
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
          content: `<@${userId
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

app.listen(PORT, () => {
  console.log('Listening on port', PORT)
  if (process.env.APP_ID === undefined || process.env.GUILD_ID === undefined) {
    console.log('Missing env vars, exiting...')
    process.exit(1)
  }

  const { chainId, url } = config.networks?.ronin as any
  if (chainId === undefined || url === undefined) {
    console.log('Missing network config, exiting...')
    process.exit(1)
  }

  const appId = process.env.APP_ID
  const guildId = process.env.GUILD_ID

  // Check if guild commands are installed (if not, install them)
  HasGuildCommands(appId, guildId, [
    AXIE_COMMAND,
    GET_ORDERS_COMMAND,
    REMOVE_ORDER_COMMAND,
    ADD_ORDER_COMMAND
  ])

  // subscribe to new blocks from the provider
  const provider = new ethers.providers.JsonRpcProvider(url, chainId)
  let time = Date.now()
  provider.on('block', (blockNumber: number) => {
    // check if we got two block almost at the same time
    const diff = Date.now() - time
    time = Date.now()
    if (diff > 1000) {
      console.log(`new block ${blockNumber} received after ${diff}ms`)
      void opportunityChecker()
      // void marketOrdersChecker()
      // todo: save recent sales to postgres
    }
  })
})

app.get('/', (req, res) => {
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
