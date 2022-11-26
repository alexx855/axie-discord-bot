import { ethers } from 'ethers'
import { ICriteria, IDiscordEmbed } from './interfaces'
import { fetchMarketByCriteria } from './market'
import { fetchApi, getClassColor } from './utils'

export const getAxieData = async (axieId: string) => {
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
          currentPrice: string
          currentPriceUsd: string
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
    if (res === null || res.data === undefined || res.data.axie === null) {
      return false
    }
    return res.data.axie
  } catch (err) {
    console.error(err)
  }
  return false
}

export async function getAxieEstimatedPrice(axieId: string, minPrice: string) {
  const axieData = await getAxieData(axieId)
  if (axieData === false) {
    return false
  }

  // todo: get axie cards stats from the api
  const { parts } = axieData

  // search the market for a floor price based on parts
  const criteria: ICriteria = {
    classes: [axieData.class],
    parts: parts.map((part) => part.id)
    // todo: fix breeding count results
    // breedCount: [listing.breedCount]
  }
  const similarMarketListings = await fetchMarketByCriteria(
    criteria,
    0,
    100,
    'PriceAsc',
    'Sale'
  )

  // the min floor price for the axies that cannot be valued
  const MIN_PRICE = ethers.utils.parseUnits(minPrice, 'ether')
  let floorPrice = MIN_PRICE.toString()
  if (similarMarketListings !== false) {
    // if unique axie, multiply 30x the MIN_PRICE
    if (similarMarketListings.total === 0) {
      floorPrice = MIN_PRICE.mul(30).toString()
    } else {
    // get the floor price from the market listings
      const currentPrice = ethers.BigNumber.from(similarMarketListings.results[0].order.currentPrice)
      // reduce the floor price by 1% so it will be the new floor price
      floorPrice = currentPrice.sub(currentPrice.div(100)).toString()
    }

    // if the floor price is less than the min price, set it to the min price
    if (ethers.BigNumber.from(floorPrice).lt(MIN_PRICE)) {
      floorPrice = MIN_PRICE.toString()
    }
  }

  return floorPrice
}

export async function getAxieEmbed(axieId: string): Promise<false | IDiscordEmbed> {
  const axie = await getAxieData(axieId)
  if (axie === false) {
    return false
  }

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
  const color = getClassColor(axie.class)
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
