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

// redis client
const redisClient = createClient({
  socket: {
    host: 'redis',
    port: 6379
  },
  password: process.env.REDIS_PASSWORD ?? 'password'
}).on('error', (err) => console.log('Redis redisClient Error', err))

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
    console.log(data)

    if (name === 'axie') {
      // Send a message into the channel where command was triggered from

      const axieID = data.options[0].value as string
      // TODO: validate axie ID

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Here is what i have about Axie #' + axieID
        }
      })
    }

    if (name === 'get_orders') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'get_orders response'
        }
      })
    }

    // "test" guild command
    if (name === 'remove_order') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'remove_order response'
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
                  custom_id: 'market_props_text',
                  style: 1,
                  label: 'Market filter props from the URL'
                }
              ]
            },
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.INPUT_TEXT,
                  custom_id: 'my_longer_text',
                  // Bigger text box for input
                  style: 1,
                  label: 'Type some (longer) text'
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

      // TODO: save the data in a DB
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `<@${userId as string}> typed the following (in a modal):\n\n${modalValues}`
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

  // test postgress
  try {
    await postgresClient.connect()
    const res = await postgresClient.query('SELECT $1::text as message', ['Hello postgres!'])
    console.log(res.rows[0].message) // Hello world!
    await postgresClient.end()
  } catch (error) {
    console.log(error)
  }

  // test redis
  try {
    await redisClient.connect()
    await redisClient.set('key', 'Hello redis!')
    const value = await redisClient.get('key')
    console.log(value)
  } catch (error) {
    console.log(error)
  }

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
