import {
  AXIE_COMMAND,
  GET_ORDERS_COMMAND,
  REMOVE_ORDER_COMMAND,
  ADD_ORDER_COMMAND,
  RONIN_WALLET_COMMAND,
  TRANSFER_ALL_AXIES_COMMAND,
} from './src/constants'
import express from 'express'
import {
  InteractionType,
  InteractionResponseType,
  MessageComponentTypes
} from 'discord-interactions'
import { ethers } from 'ethers'
import { randomUUID } from 'crypto'
import { MarketPropsInterface, IMarketOrder, IDiscordEmbed } from './src/interfaces'
import { getRedisMarketOrders, setMarketOrders, addMarketOrder } from './src/market'
import { VerifyDiscordRequest } from './src/utils'
import discordOrdersTicker from './src/onblock/discordOrdersTicker'
// import marketRecentListingsTicker from './src/onblock/marketRecentListingsTicker'
import { batchTransferAxies, getAxieContract, getAxieIdsFromAccount, getUSDCContract, getWETHContract } from 'axie-ronin-ethers-js-tools'
import { getAxieEmbed } from './src/axies'
import path from 'node:path'

import * as dotenv from 'dotenv'
dotenv.config()

// Create an express app
const app = express()

// Parse request body and verifies incoming requests using discord-interactions package
console.log('Verifying requests')

if (process.env.PRIVATE_KEY === undefined || process.env.SKIMAVIS_DAPP_KEY === undefined || process.env.DISCORD_PUBLIC_KEY === undefined || process.env.DISCORD_GUILD_ID === undefined) {
  throw new Error('Missing environment variables')
}

app.use(
  express.json({ verify: VerifyDiscordRequest(process.env.DISCORD_PUBLIC_KEY) })
)

// Get jsonrpc provider for ronin network see https://docs.skymavis.com/api/rpc
const connection = {
  url: 'https://api-gateway.skymavis.com/rpc',
  headers: {
    'x-api-key': process.env.SKIMAVIS_DAPP_KEY // get from https://developers.skymavis.com/console/applications/
  }
}
const network = {
  name: 'ronin',
  chainId: 2020
}
const provider = new ethers.providers.JsonRpcProvider(connection, network)

// Import the wallet private key from the environment
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

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
    if (name === AXIE_COMMAND.name) {
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
        console.log(error)
      }
    } else if (name === RONIN_WALLET_COMMAND.name) {
      // get bot wallet account info, balance, etc
      const address = await wallet.getAddress()

      // get RON balance
      const balance = await provider.getBalance(address)
      const balanceInEther = ethers.utils.formatEther(balance)

      // get WETH balance
      const wethContract = await getWETHContract(provider)
      const wethBalance = await wethContract.balanceOf(address)
      const wethBalanceInEther = ethers.utils.formatEther(wethBalance)

      // get axies balance for the address
      const axieContract = await getAxieContract(provider)
      const axiesBalance = await axieContract.balanceOf(address)

      // get USDC balance
      const usdcContract = await getUSDCContract(provider)
      const usdcBalance = await usdcContract.balanceOf(address)
      const usdcBalanceFormated = ethers.utils.formatUnits(usdcBalance, 6)

      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Address: ${address.replace('0x', 'ronin:')}\nRON: ${balanceInEther}\nWETH: ${wethBalanceInEther}\nUSDC: ${usdcBalanceFormated}\nAxies: ${ethers.BigNumber.from(axiesBalance).toString()}`,
        }
      })
    } else if (name === TRANSFER_ALL_AXIES_COMMAND.name) {
      try {
        const addressFrom = await wallet.getAddress()
        const addressTo: string = data.options[0].value.replace('ronin:', '0x').toLowerCase()
        console.log(`transfering all axies from ${addressFrom} to ${addressTo}`)
        // get all axies ids from the account
        const axieIds = await getAxieIdsFromAccount(addressFrom, provider)
        console.log('axieIds', axieIds)
        const axies: string[] = axieIds.map((axieId) => {
          return axieId.toString()
        })
        // wait for tx to be mined and get receipt
        // await wallet.connect(provider)
        batchTransferAxies(addressFrom, addressTo, axies, wallet)
          .then((receipt) => {
            console.log('receipt', receipt.transactionHash)
            // TODO: update message with link to the tx
            // components: [
            //   {
            //     type: 1,
            //     components: [
            //       {
            //         type: 2,
            //         label: 'Open Tx on Ronin explorer',
            //         style: 5,
            //         url: exploreTxLink
            //       }
            //     ]
            //   }
            // ],
            // console.log('receipt', receipt)
            // const receipt2 = await provider.waitForTransaction(receipt.transactionHash)
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            // const exploreTxLink = `https://app.roninchain.com/tx/${receipt2.transactionHash}`
          })
          .catch((error) => {
            console.log(error)
          })

        // Send a message into the channel where command was triggered from
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: `Transfering ${axies.length} axies:`,
                description: `**From:** ${addressFrom.replace('0x', 'ronin:')} \n **To:** ${addressTo.replace('0x', 'ronin:')}`
              }
            ],
          },
        })
      } catch (error) {
        console.log(error)
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Error: Unknown error'
          }
        })
      }
    }

    // Check for allowed user only, we dont want to anyone else to use this commands
    const userId: string = req.body.member.user.id

    const adminId = process.env.DISCORD_USER_ID ?? ''
    if (userId !== adminId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Only admin'
        }
      })
    }

    if (name === GET_ORDERS_COMMAND.name) {
      // Get orders from redis
      const orders = await getRedisMarketOrders()
      let content = ''

      if (orders.length > 0) {
        // console.log('orders', orders)
        content = ''

        for (const order of orders) {
          content = content + 'Order ID: **' + order.id.toString() + '**\nTrigger price: ' + order.triggerPrice.toString() + ' ETH \n'
          content = content + order.marketUrl + '\n'
          if (order !== orders[orders.length - 1]) {
            content = content + '------------------------\r\n'
          }
        }
      } else {
        content = 'I\'ve no open orders.\nUse **/add_order** to add one.'
      }

      const embed = {
        description: content,
        type: 'rich'
      }
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `I've the following open order${orders.length > 1 ? 's' : ''}:\r\n`,
          embeds: [embed]
        }
      })
    }

    if (name === REMOVE_ORDER_COMMAND.name) {
      // Get orders date from options value, it's the id of the order, shame on me (┬┬﹏┬┬)
      const orderID = data.options[0].value as string
      // Default response
      let content = `Order ID: **${orderID}** not found`
      // Check if order exists, get current orders list
      const orders = await getRedisMarketOrders()
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

    if (data.name === ADD_ORDER_COMMAND.name) {
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
      // get market props from modal, it's the market url ej: https://app.axieinfinity.com/marketplace/axies/?class=Plant&part=ears-sakura&part=mouth-silence-whisper&part=horn-strawberry-shortcake&auctionTypes=Sale
      const marketPropsFromModal = data.components[0].components[0].value as string
      const marketUrl = marketPropsFromModal

      // TODO: get from query params
      // convert to params, split ? and &
      const marketPropsArray = marketPropsFromModal.replace(
        'https://app.axieinfinity.com/marketplace/axies/',
        ''
      ).split('?')[1]?.split('&')

      // TODO: check if the props are valid
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
      if (!priceFromModal._isBigNumber || !priceFromModal.gte(0)) {
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

      const embed: IDiscordEmbed = {
        title: 'Order ' + newOrder.id,
        description: `Market URL: ${marketUrl}\nTrigger price: ${ethers.utils.formatEther(priceFromModal)} ETH`,
        type: 'rich'
      }

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `<@${userId
            }> created the following order:\n`,
          embeds: [embed],
          tts: false,
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

app.listen(3000, () => {
  if (process.env.DISCORD_CLIENT_ID === undefined || process.env.DISCORD_GUILD_ID === undefined) {
    console.log('Missing env vars, exiting...')
    process.exit(1)
  }

  let time = Date.now()
  // Subscribe to new blocks
  setInterval(() => {
    const diff = Date.now() - time
    time = Date.now()

    // Not sure why some blocks came at the same time, but we don't want to process them together
    if (diff < 100) {
      return
    }

    console.log('\x1b[33m%s\x1b[0m', `new worker received after ${diff}ms`)
    // track time
    const sTime = Date.now()

    // // get recent listings, scrape for floor price axies
    // marketRecentListingsTicker(provider, wallet)
    //   .catch((error) => console.log(error))
    //   .finally(() => console.log('\x1b[36m%s\x1b[0m', `marketRecentListingsTicker finished after ${Date.now() - sTime}ms`))

    // check for the discord created orders by criteria
    discordOrdersTicker(provider, wallet)
      .catch((error) => console.log(error))
      .finally(() => console.log('\x1b[36m%s\x1b[0m', `discordOrdersTicker finished after ${Date.now() - sTime}ms`))
  }, 10000)
})

app.get('/', (req, res) => {
  res.send('Hello Bot!')
})

// Privacy policy and terms of service, required for Discord App
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy-policy.html'))
})

app.get('/terms-of-service', (req, res) => {
  res.sendFile(path.join(__dirname, 'terms-of-service.html'))
})
