import { type PublicClient, formatEther, parseEther } from 'viem'
import { type IAxieData, type ICriteria, type IDiscordEmbed } from './interfaces'
import { fetchAxieQuery } from './utils'

import { AXIE_PROXY } from '@roninbuilders/contracts'
import { fetchMarketplaceAxiesByCriteria } from './marketplace/axies-by-criteria'

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
  const variables = {
    axieId
  }

  try {
    const res = await fetchAxieQuery<IAxieData>(query, variables)
    if (res?.data?.axie === null) {
      return false
    }
    return res?.data?.axie
  } catch (err) {
    console.error(err)
  }
  return false
}

export async function getAxieEstimatedPrice (axieData: IAxieData['data']['axie']) {
  const { parts } = axieData

  // search the market for a floor price based on criteria
  const criteria: ICriteria = {
    classes: [axieData.class],
    parts: parts.map((part) => part.id)
    // todo: fix breeding count results
    // breedCount: [listing.breedCount]
  }
  const similarMarketListings = await fetchMarketplaceAxiesByCriteria(
    criteria,
    0,
    100,
    'PriceAsc',
    'Sale'
  )

  let price = 0n

  if (similarMarketListings !== false) {
    // if few listed or virgin , multiply 3x the MIN_PRICE
    if (axieData.breedCount === 0 || similarMarketListings.total < 100) {
      price = price * 3n
    } else {
      // get the floor price from the market listings
      const currentPrice = parseEther(similarMarketListings.results[0].order.currentPrice, 'wei')
      // reduce the floor price by 1% so it will be the new floor price
      price = currentPrice - currentPrice / 100n
    }

    // ?? if the floor price is less than the min price, set it to the min price
    // will need another request to get the min price from marketplace
  }

  return price
}

export async function getAxieEmbed (axieId: string, resume = false) {
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
    const currentPrice = formatEther(parseEther(axie.order.currentPrice, 'wei'))
    content = content + `\n**On Sale:** Ξ${currentPrice} (${axie.order.currentPriceUsd} USD)`
  }

  if (!resume) {
    content = content + `\n\r**Parts:**\n${axie.parts.map((part) => `${part.type}: ${part.name} (${part.class})`).join('\n')}`
    content = content + `\n\r**Stats:**\n${Object.keys(axie.stats).map((key: string) => `${key}: ${axie.stats[key as keyof typeof axie.stats]}`).join('\n')}`
    content = content + `\n\r**Potential:**\n${Object.keys(axie.potentialPoints).filter((key: string) => axie.potentialPoints[key as keyof typeof axie.potentialPoints] > 0).map((key: string) => `${key}: ${axie.potentialPoints[key as keyof typeof axie.potentialPoints]}`).join('\n')}`
    content = content + `\n\r**Owner:** ${axie.owner}`
    // content = content + `\nhttps://app.axieinfinity.com/profile/ronin:${axie.owner.slice(2)}`
  }

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

export function getClassColor(axieClassName: string) {
  let color = 0x000000
  switch (axieClassName) {
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

  return color
}

export async function getAxieTransferHistory (axieId: string) {
  const query = 'query GetAxieTransferHistory($axieId: ID!, $from: Int!, $size: Int!) {\n\taxie(axieId: $axieId) {\n\t\tid\n\t\ttransferHistory(from: $from, size: $size) {\n\t\t\t...TransferRecords\n\t\t\t__typename\n\t\t}\n\t\tethereumTransferHistory(from: $from, size: $size) {\n\t\t\t...TransferRecords\n\t\t\t__typename\n\t\t}\n\t\t__typename\n\t}\n}\nfragment TransferRecords on TransferRecords {\n\ttotal\n\tresults {\n\t\tfrom\n\t\tto\n\t\ttimestamp\n\t\ttxHash\n\t\twithPrice\n\t\t__typename\n\t}\n\t__typename\n}\n'
  interface IGetAxieTransferHistoryResponse {
    data: {
      axie: {
        id: string
        transferHistory: {
          total: number
          results: Array<{
            from: string
            to: string
            timestamp: number
            txHash: string
            withPrice: number
          }>
        }
        ethereumTransferHistory: {
          total: number
          results: Array<{
            from: string
            to: string
            timestamp: number
            txHash: string
            withPrice: number
          }>
        }
      }
    }
  }
  const variables = { axieId, from: 0, size: 5 }
  const res = await fetchAxieQuery<IGetAxieTransferHistoryResponse>(query, variables)
  return res?.data.axie === undefined ? null : res.data.axie
}

export async function getMinPriceAxie (axieId: string) {
  const query = 'query GetMinPriceAxie($axieId: ID!) {\n  axie(axieId: $axieId) {\n    id\n    minPrice\n    __typename\n  }\n}\n'
  interface IGetMinPriceAxieResponse {
    data: {
      axie: {
        id: string
        minPrice: number
      }
    }
  }
  const variables = { axieId }
  const res = await fetchAxieQuery<IGetMinPriceAxieResponse>(query, variables)
  return res?.data.axie === undefined ? null : res.data.axie.minPrice
}

export async function getAxieIdsFromAddress (address: `0x${string}`, publicClient: PublicClient) {
  const balance = await publicClient.readContract({
    address: AXIE_PROXY.address,
    abi: AXIE_PROXY.abi,
    functionName: 'balanceOf',
    args: [address]
  })

  const axieIds = []
  for (let i = 0; i < balance; i++) {
    const axieId = await publicClient.readContract({
      address: AXIE_PROXY.address,
      abi: AXIE_PROXY.abi,
      functionName: 'tokenOfOwnerByIndex',
      args: [address, BigInt(i)]
    })

    axieIds.push(axieId)
  }

  return axieIds
}
