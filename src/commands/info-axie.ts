import { OPEN_MARKETPLACE_APP_LABEL } from '../constants'
import { getAxieEmbed } from '../axies'
import { InteractionResponseType } from 'discord-interactions'

export const infoAxieCommandHandler = async (axieId: string) => {
  if (process.env.SKIMAVIS_DAPP_KEY == null) {
    throw new Error('Skimavis Dapp key not valid, check .env file')
  }

  try {
    const embed = await getAxieEmbed(axieId)
    const marketplaceLink = `https://app.axieinfinity.com/marketplace/axies/${axieId}/`

    const embeds = []
    if (embed !== false) {
      embeds.push(embed)
    } else {
      embeds.push({
        title: `Axie #${axieId}`,
        description: `Axie #${axieId} not found`,
        color: 0xff0000 // Red color
      })
    }

    // Send a message into the channel where command was triggered from
    console.log(`Sending axie info for ${axieId}`)
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        components: embed !== false
          ? [{
              type: 1,
              components: [
                {
                  type: 2,
                  label: OPEN_MARKETPLACE_APP_LABEL,
                  style: 5,
                  url: marketplaceLink
                }
              ]
            }]
          : undefined,
        embeds
      }
    }
  } catch (error) {
    console.error(`Error getting axie info for ${axieId}`, error)
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: `Error getting axie #${axieId}`,
          description: (error as any).shortMessage ?? 'Unknown error',
          color: 0xff0000 // Red color
        }],
        tts: false
      }
    }
  }
}
