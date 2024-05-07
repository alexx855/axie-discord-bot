import { InteractionType, InteractionResponseType } from 'discord-interactions'
import { type Request, type Response } from 'express'
import {
  WALLET_COMMAND,
  CREATE_AXIE_SALE_ALL_COMMAND,
  TRANSFER_AXIE_ALL_COMMAND,
  TRANSFER_AXIE_COMMAND,
  CANCEL_AXIE_SALE_ALL_COMMAND,
  CANCEL_AXIE_SALE_COMMAND,
  BUY_AXIE_COMMAND,
  CREATE_AXIE_SALE_COMMAND,
  AXIE_INFO_COMMAND,
  PING_COMMAND
} from './constants'
import { walletCommandHandler } from './commands/wallet'
import { cancelAllAxieSalesCommandHandler, cancelSaleAxieCommandHandler, sellAllAxiesCommandHandler, sellAxieCommandHandler } from './commands/marketplace'
import { discordRequest, roninAddressToHex } from './utils'
import { buyAxieCommandHandler } from './commands/buy-axie'
import { transferAllAxiesCommandHandler } from './commands/batch-transfer-axie'
import { transferAxieCommandHandler } from './commands/transfer-axie'
import { infoAxieCommandHandler } from './commands/info-axie'

export const interactionsHandler = async (req: Request, res: Response) => {
  const { type, data } = req.body
  console.log(JSON.stringify(req.body))
  const userId: string = req.body.member?.user?.id ?? 'unknown'
  console.log(`Received interaction ${JSON.stringify(type)} from ${userId}`)

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
    switch (name) {
      case PING_COMMAND.name: {
        const currentTime = new Date().toLocaleTimeString() // Gets the current server time
        return res.status(200).send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          //  ephemeral: true
          data: {
            content: `Current server time: ${currentTime}`
            // ephemeral: true
          }
        })
      }
      case AXIE_INFO_COMMAND.name: {
        const axieId = data.options[0].value as string
        return res.status(200).send(await infoAxieCommandHandler(axieId))
      }
      case WALLET_COMMAND.name:
        return res.status(200).send(await walletCommandHandler())
      case BUY_AXIE_COMMAND.name: {
        const axieId = data.options[0].value as string

        // Syncronous call to buyAxieCommandHandler
        buyAxieCommandHandler(axieId)
          .then(result => {
            // Update the original message with the result
            const { components, embeds } = result.data
            void discordRequest(`webhooks/${process.env.DISCORD_CLIENT_ID}/${req.body.token}/messages/@original`, {
              method: 'PATCH',
              body: {
                components,
                embeds
              }
            })
          })
          .catch(err => { console.error(err) })

        // Early return deferring the response
        return res.status(200).send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
        })
      }
      case CREATE_AXIE_SALE_COMMAND.name: {
        const axieId = data.options[0].value as string
        const basePrice = data.options[1].value as string
        const endedPrice = data.options[2]?.value as string
        const duration = Number(data.options[3]?.value || 0)
        return res.status(200).send(await sellAxieCommandHandler(BigInt(axieId), basePrice, endedPrice, duration))
      }
      case CREATE_AXIE_SALE_ALL_COMMAND.name: {
        const basePrice = data.options[0].value as string
        const endedPrice = data.options[1]?.value as string
        const duration = Number(data.options[2]?.value || 0)
        return res.status(200).send(await sellAllAxiesCommandHandler(basePrice, endedPrice, duration))
      }
      case CANCEL_AXIE_SALE_COMMAND.name: {
        const axieId = data.options[0].value as string
        return res.status(200).send(await cancelSaleAxieCommandHandler(BigInt(axieId)))
      }
      case CANCEL_AXIE_SALE_ALL_COMMAND.name:
        return res.status(200).send(await cancelAllAxieSalesCommandHandler())
      case TRANSFER_AXIE_COMMAND.name: {
        const axieId = data.options[0].value as string
        const addressTo = roninAddressToHex(data.options[1].value as string)
        return res.status(200).send(await transferAxieCommandHandler(axieId, addressTo))
      }
      case TRANSFER_AXIE_ALL_COMMAND.name: {
        const addressTo = roninAddressToHex(data.options[0].value as string)
        transferAllAxiesCommandHandler(addressTo)
          .then(result => {
            // Update the original message with the result
            const { components, embeds } = result.data
            void discordRequest(`webhooks/${process.env.DISCORD_CLIENT_ID}/${req.body.token}/messages/@original`, {
              method: 'PATCH',
              body: {
                components,
                embeds
              }
            })
          })
          .catch(err => { console.error(err) })
        return res.status(200).send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
        })
      }
      default:
        return res.status(400).send({
          data: {
            content: `Unknown command ${JSON.stringify(name)}`
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

    // const channelId: string = req.body.channel_id
    // const messageId: string = req.body.message.id

    // if (data.custom_id === 'click_one') {
    //   res.send({
    //     type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    //     data: {
    //       content: 'Loading...'
    //     }
    //   })

    //   // Perform the long task
    //   await longTask()

    //   // Edit the message with the result of the long task
    //   editMessage(channelId, messageId, 'Done!')
    // }
  }
}
