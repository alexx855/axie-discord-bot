import { ethers } from 'ethers'
import { fetchApi } from '../utils'
import { IDiscordEmbed } from '../interfaces'

export default async function getAxieEmbedDetails(axieId: string): Promise<false | IDiscordEmbed> {
  // Send a simple query to the graphql api to get the axie data
  const query = `query GetAxieDetail($axieId: ID!) {
      axie(axieId: $axieId) {
        ...AxieDetail
      }
    }
    
    fragment AxieDetail on Axie {
      id
      image
      class
      chain
      name
      genes
      newGenes
      owner
      birthDate
      bodyShape
      class
      sireId
      sireClass
      matronId
      matronClass
      stage
      title
      breedCount
      level
      figure {
        atlas
        model
        image
      }
      parts {
        ...AxiePart
      }
      stats {
        ...AxieStats
      }
      order {
        ...OrderInfo
      }
      ownerProfile {
        name
      }
      battleInfo {
        ...AxieBattleInfo
      }
      children {
        id
        name
        class
        image
        title
        stage
      }
      potentialPoints {
        beast
        aquatic
        plant
        bug
        bird
        reptile
        mech
        dawn
        dusk
      }
    }
    
    fragment AxieBattleInfo on AxieBattleInfo {
      banned
      banUntil
      level
    }
    
    fragment AxiePart on AxiePart {
      id
      name
      class
      type
      specialGenes
      stage
    }
    
    fragment AxieStats on AxieStats {
      hp
      speed
      skill
      morale
    }
    
    fragment OrderInfo on Order {
      id
      maker
      kind
      assets {
        ...AssetInfo
      }
      expiredAt
      paymentToken
      startedAt
      basePrice
      endedAt
      endedPrice
      expectedState
      nonce
      marketFeePercentage
      signature
      hash
      duration
      timeLeft
      currentPrice
      suggestedPrice
      currentPriceUsd
    }
    
    fragment AssetInfo on Asset {
      erc
      address
      id
      quantity
      orderId
    }
  `

  interface IAxieData {
    data: {
      axie: {
        id: string
        class: string
        chain: string
        name: string
        newGenes: string
        ownerProfile: {
          name: string | null
        }
        breedCount: number
        order: {
          currentPrice: number
          currentPriceUsd: number
        } | null
        owner: string
        stats: {
          hp: number
          speed: number
          skill: number
          morale: number
        }
        potentialPoints: {
          beast: number
          aquatic: number
          plant: number
          bug: number
          bird: number
          reptile: number
          mech: number
          dawn: number
          dusk: number
        }
        parts: Array<{
          id: string
          name: string
          type: string
          class: string
          specialGenes: string
          stage: number
        }>
        title: string
        description: string
        thumbnail: {
          url: string
        }
        color: number
        type: string
      }
    }
  }

  const variables = {
    axieId
  }

  try {
    const res = await fetchApi<IAxieData>(query, variables)
    if (res !== null) {
      const axie = res.data.axie

      let content = ''
      content = content + `**Class:** ${axie.class}`
      content = content + `\n**Breed Count:** ${axie.breedCount}`
      const pureness = axie.parts.filter((part: any) => part.class === axie.class).length
      content = content + `\n**Pureness:** ${pureness}`

      if (axie.order !== null) {
        const currentPrice = ethers.utils.formatEther(axie.order.currentPrice)
        content = content + `\n**On Sale:** Ξ${currentPrice} (${axie.order.currentPriceUsd} USD)`
        content = content + `\nhttps://marketplace.axieinfinity.com/axie/${axie.id}`
      }

      content = content + `\n\r**Parts:**\n${axie.parts.map((part) => `${part.type}: ${part.name} (${part.class})`).join('\n')}`
      // content = content + `\n\r**Origin Stats:**\n`
      content = content + `\n\r**Stats:**\n${Object.keys(axie.stats).map((key: string) => `${key}: ${axie.stats[key as keyof typeof axie.stats]}`).join('\n')}`
      content = content + `\n\r**Potential:**\n${Object.keys(axie.potentialPoints).filter((key: string) => axie.potentialPoints[key as keyof typeof axie.potentialPoints] > 0).map((key: string) => `${key}: ${axie.potentialPoints[key as keyof typeof axie.potentialPoints]}`).join('\n')}`
      content = content + `\n\r**Owner:** ${axie.ownerProfile?.name ?? 'Unknown'}`
      // content = content + `\nhttps://explorer.roninchain.com/address/ronin:${axie.owner.slice(2)}`
      content = content + `\nhttps://app.axieinfinity.com/profile/ronin:${axie.owner.slice(2)}`

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
      const embed: IDiscordEmbed = {
        title: `Axie #${axie.id}`,
        description: content,
        thumbnail: {
          url: `https://axiecdn.axieinfinity.com/axies/${axie.id}/axie/axie-full-transparent.png`
        },
        color,
        type: 'rich'
      }
      return embed
    }
    return false
  } catch (error) {
    console.log(error)
    return false
  }
}
