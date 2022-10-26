/* eslint-disable @typescript-eslint/no-misused-promises */
import express from 'express'
import {
  InteractionType,
  InteractionResponseType,
  MessageComponentTypes
} from 'discord-interactions'
import {
  fetchApi,
  MarketPropsInterface,
  IMarketOrder,
  VerifyDiscordRequest,
  getMarketOrders,
  setMarketOrders
} from './utils'
import {
  HasGuildCommands,
  AXIE_COMMAND,
  ADD_ORDER_COMMAND,
  GET_ORDERS_COMMAND,
  REMOVE_ORDER_COMMAND
} from './commands'
import * as dotenv from 'dotenv'
import { ethers } from 'ethers'
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
app.post('/interactions', async (req, res) => {
  // Interaction type and data
  const { type, id, data } = req.body
  // console.log(req.body)
  // console.log('Interaction ID:', id)

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

      // Send a simple query to the graphql api to get the axie data
      const query = `
        query GetAxieDetail($axieId: ID!) {
          axie(axieId: $axieId) {
            id
            name
            owner
            genes
            class
            breedCount
            parts {
                id
                name
                class
                type
            }
            stats {
                hp
                speed
                skill
                morale
            }
            auction {
                startingPrice
                endingPrice
                startingTimestamp
                endingTimestamp
                duration
                timeLeft
                currentPrice
                currentPriceUSD
                suggestedPrice
                seller
                listingIndex
                state
            }
            ownerProfile {
                name
            }
            battleInfo {
                banned
                banUntil
                level
            }
            children {
                id
                name
                class
            }
          }
        }
      `
      const variables = {
        axieId
      }

      let content = 'Axie not found'

      try {
        const dada = await fetchApi(query, variables)

        if (dada?.axie) {
          const axie = data.axie
          content = `
            **${axie.name}**
            Class: ${axie.class}
            Owner: ${axie.ownerProfile?.name ?? axie.owner}
            Price: ${axie.auction?.currentPriceUSD ?? 'Not for sale'}
            Link: https://marketplace.axieinfinity.com/axie/${axie.id}
          `
        }
      } catch (error) {
        console.log(error)
      }

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content
        }
      })
    }

    if (name === 'get_orders') {
      // response
      let content = 'There are no orders'
      // Get orders from redis
      const orders = await getMarketOrders()

      if (orders.length > 0) {
        // console.log((orders[0] as any).marketProps)

        content =
          content + 'Here is what i have about the open orders:\r\n\r\n'
        console.log('orders', orders)

        for (const order of orders) {
          // content = content + 'Order ' + order.date.toString() + '\nPrice: ' + order.price.toString() + ' \n'
          // add show original props
          content = content + order.marketUrl + '\n'
          // add a separator line, if not the last order
          if (order !== orders[orders.length - 1]) {
            content = content + '------------------------\r\n'
          }
        }
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

      // save the order in redis, i'll plan to use pub/sub to notify the bot when a order status changes
      try {
        let marketProps = data.components[0].components[0].value as string
        const marketUrl = marketProps
        //  remove marke url (https://app.axieinfinity.com/marketplace/axies/), leave only the props
        // ej: https://app.axieinfinity.com/marketplace/axies/?class=Plant&part=ears-sakura&part=mouth-silence-whisper&part=horn-strawberry-shortcake&auctionTypes=Sale
        marketProps = marketProps.replace(
          'https://app.axieinfinity.com/marketplace/axies/',
          ''
        )
        // convert to req params, split ? and &
        const marketPropsArray = marketProps.split('?')[1]?.split('&')
        // check if the props are valid
        if (marketPropsArray.length === 0) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'Invalid market props'
            }
          })
        }

        // group the same props by key, keep values
        const marketPropsGrouped: MarketPropsInterface =
          marketPropsArray.reduce((acc: any, curr) => {
            const [key, value] = curr.split('=')
            if (acc[key]) {
              acc[key].push(value)
            } else {
              acc[key] = [value]
            }
            return acc
          }, {})

        // get and parse trigger price
        const price = data.components[1].components[0].value
        if (
          !price ||
          ethers.utils.parseUnits(price, 'ether').toString() === '0'
        ) {
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
          triggerPrice: price
        }

        // get current orders list
        const orders = await getMarketOrders()

        // save to redis
        await setMarketOrders([...orders, newOrder])
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
