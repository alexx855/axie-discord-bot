/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { InteractionResponseType } from 'discord-interactions'
import { fetchApi } from '../utils'

export default async function handleAxieCommand(axieId: string, res: any): Promise<any> {
  // Send a simple query to the graphql api to get the axie data
  const query = `query GetAxieDetail($axieId: ID!) {
      axie(axieId: $axieId) {
        id
        name
        owner
        genes
        newGenes
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
        battleInfo {
            banned
            banUntil
            level
        }
      }
    }
  `
  const variables = {
    axieId
  }

  let content = 'Axie not found'
  let embeds = null

  try {
    const res = await fetchApi(query, variables)
    console.log(res?.data?.axie)
    if (res?.data?.axie) {
      const axie = res?.data?.axie
      content = ''
      // **${axie.name}**`
      // Class: ${axie.class}
      // Owner: ${axie.owner}
      // Link: https://marketplace.axieinfinity.com/axie/${axie.id}

      // custom embed color by axie class
      let color
      switch (axie.class) {
        case 'Beast':
          color = 0xfdb014
          break
        case 'Bug':
          color = 0xff433e
          break
        case 'Bird':
          color = 0xfa59a0
          break
        case 'Plant':
          color = 0xafdb1b
          break
        case 'Aquatic':
          color = 0x00f5f8
          break
        case 'Reptile':
          color = 0x9967fb
          break
        case 'Dusk':
          color = 0x29fae
          break
        case 'Dawn':
          color = 0x7183e3
          break
        case 'Mech':
          color = 0x71898e
          break
        default:
          color = 0xffffff
          break
      }

      // todo: parse axie parts and stats
      // const axieGenes = axie.newGenes
      // todo: get estimated price from the marketplace if its for sale

      embeds = [
        {
          title: `Axie #${axie.id}`,
          description: `**${axie.name}**\nMarket:\nhttps://marketplace.axieinfinity.com/axie/${axie.id}\nOwner:\nhttps://explorer.roninchain.com/address/ronin:${axie.owner.slice(2)}`,
          thumbnail: {
            url: `https://axiecdn.axieinfinity.com/axies/${axie.id}/axie/axie-full-transparent.png`
          },
          color,
          type: 'rich'
        }
      ]
    }
  } catch (error) {
    console.log(error)
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      embeds
    }
  })
}
