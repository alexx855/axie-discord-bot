/* eslint-disable @typescript-eslint/no-misused-promises */
import * as dotenv from 'dotenv'
import express from 'express'
import {
  InteractionType,
  InteractionResponseType,
  MessageComponentTypes
} from 'discord-interactions'
import { VerifyDiscordRequest } from './utils'
import { createClient } from 'redis'
import { HasGuildCommands, AXIE_COMMAND, ADD_ORDER_COMMAND, GET_ORDERS_COMMAND, REMOVE_ORDER_COMMAND } from './commands'
import { Client } from 'pg'
dotenv.config()

interface OrderInterface {
  date: number
  userId: string
  originalMarketProps: string
  marketProps: any
  price: number
}

interface MarketPropsInterface {
  [key: string]: any
}

// redis client
const redisClient = createClient({
  socket: {
    host: 'redis',
    port: 6379
  },
  password: process.env.REDIS_PASSWORD ?? 'password'
}).on('error', (err) => console.log('Redis redisClient Error', err))
redisClient.connect().catch((err) => console.log('Redis redisClient Error', err))

// postgres client
const postgresClient = new Client(
  {
    user: process.env.POSTGRES_USER ?? 'postgres',
    host: 'postgres',
    database: process.env.POSTGRES_DB ?? 'axiebot',
    password: process.env.POSTGRES_PASSWORD ?? 'password',
    port: 5432
  }
).on('error', (err) => console.log('Postgres postgresClient Error', err))
postgresClient.connect().catch((err) => console.log('Postgres postgresClient Error', err))

// // test postgress
// try {
//   await postgresClient.connect()
//   const res = await postgresClient.query('SELECT $1::text as message', ['Hello postgres!'])
//   console.log(res.rows[0].message) // Hello world!
//   await postgresClient.end()
// } catch (error) {
//   console.log(error)
// }

// // test redis
// try {
//   await redisClient.connect()
//   await redisClient.set('key', 'Hello redis!')
//   const value = await redisClient.get('key')
//   console.log(value)
// } catch (error) {
//   console.log(error)
// }

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
app.post('/axiebot/interactions', async (req, res) => {
  // Interaction type and data
  const { type, id, data } = req.body
  console.log(req.body)
  console.log('Interaction ID:', id)

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

      const axieID = data.options[0].value as string
      let content = 'Here is what i have about this Axie #' + axieID
      // TODO: get axie data from rpc
      content += ' \n\n https://axieinfinity.com/axie/' + axieID

      // TODO: check if valid axie id

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
      const orders = await redisClient.get('orders')

      if (orders !== null) {
        const ordersArray: OrderInterface[] = JSON.parse(orders)

        if (ordersArray !== null && ordersArray.length > 0) {
          console.log((orders[0] as any).marketProps)
          // {
          //   class: [ 'Plant' ],
          //   part: [
          //     'ears-sakura',
          //     'mouth-silence-whisper',
          //     'horn-strawberry-shortcake'
          //   ],
          //   auctionTypes: [ 'Sale' ]
          // }

          content = content + 'Here is what i have about the open orders:\r\n\r\n'
          console.log('orders', ordersArray)

          for (const order of ordersArray) {
            // content = content + 'Order ' + order.date.toString() + '\nPrice: ' + order.price.toString() + ' \n'
            // add show original props
            content = content + order.originalMarketProps + '\n'
            // add a separator line, if not the last order
            if (order !== ordersArray[ordersArray.length - 1]) {
              content = content + '------------------------\r\n'
            }
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

    // "test" guild command
    if (name === 'remove_order') {
      // Get orders date from options value
      const orderDate = data.options[0].value as string
      // return content
      let content = 'There are no orders'
      // Check if order exists
      const orders = await redisClient.get('orders')
      if (orders !== null) {
        const ordersArray: OrderInterface[] = JSON.parse(orders)
        // Check if order exists
        const orderIndex = ordersArray.findIndex(order => order.date.toString() === orderDate)
        if (orderIndex !== -1) {
          // Remove order
          ordersArray.splice(orderIndex, 1)
          // Save orders
          await redisClient.set('orders', JSON.stringify(ordersArray))
          // Set content
          content = `Order ${orderDate} removed`
        } else {
          // Set content
          content = `Order ${orderDate} not found`
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
        modalValues += `${inputComponent.custom_id as string}: ${inputComponent.value as string}\n`
      }

      // save the order in redis, i'll plan to use pub/sub to notify the bot when a order status changes
      try {
        let marketProps = data.components[0].components[0].value as string
        const originalMarketProps = marketProps
        //  remove marke url (https://app.axieinfinity.com/marketplace/axies/), leave only the props
        // ej: https://app.axieinfinity.com/marketplace/axies/?class=Plant&part=ears-sakura&part=mouth-silence-whisper&part=horn-strawberry-shortcake&auctionTypes=Sale
        marketProps = marketProps.replace('https://app.axieinfinity.com/marketplace/axies/', '')
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
        const marketPropsGrouped: MarketPropsInterface = marketPropsArray.reduce((acc: any, curr) => {
          const [key, value] = curr.split('=')
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (acc[key]) {
            acc[key].push(value)
          } else {
            acc[key] = [value]
          }
          return acc
        }, {})

        console.log('marketPropsGrouped', marketPropsGrouped)

        // get price
        // TODO: validate price
        const price = data.components[1].components[0].value

        // create the new order
        const newOrder: OrderInterface = {
          date: Date.now(),
          userId,
          marketProps: marketPropsGrouped,
          originalMarketProps,
          price
        }

        let newOrders = []
        // get current orders list
        const orders = await redisClient.get('orders')

        if (orders !== null) {
          // parse the orders
          newOrders = JSON.parse(orders)
        }

        // add the new order
        newOrders.push(newOrder)

        // save to redis
        await redisClient.set('orders', JSON.stringify(newOrders))
      } catch (error) {
        console.log(error)
      }

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `<@${userId as string}> created the following order:\n\n${modalValues}`
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

app.get('/axiebot', async (req, res) => {
  res.send('hello axiebot!')
})

app.get('/axiebot/terms-of-service', (req, res) => {
  // TODO: Add terms of service, discord requires it for the authorized application
  res.send('Terms of Service')
})

app.get('/axiebot/privacy-policy', (req, res) => {
  // TODO: Add privacy policy, discord requires it for the authorized application
  res.send('Privacy Policy')
})
