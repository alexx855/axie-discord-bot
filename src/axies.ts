import { ethers } from 'ethers'
import { IAxieData, ICriteria, IDiscordEmbed, IMarketBuyOrder } from './interfaces'
import { fetchMarketByCriteria } from './market'
import { DiscordRequest, fetchAxieQuery } from './utils'
import { buyMarketplaceOrder } from 'axie-ronin-ethers-js-tools'

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
    if (res === null || res.data === undefined || res.data.axie === null) {
      return false
    }
    return res.data.axie
  } catch (err) {
    console.error(err)
  }
  return false
}

export async function buyAxie(order: IMarketBuyOrder, provider: ethers.providers.JsonRpcProvider, wallet: ethers.Wallet) {
  // call the contract from provider buy with the order

  // Wait for the transaction to be mined
  const skymavisApyKey = process.env.SKIMAVIS_DAPP_KEY ?? '' // get from https://developers.skymavis.com/console/applications/
  console.log('\x1b[33m%s\x1b[0m', 'The bot will try to execute the tx order now')
  const receipt = await buyMarketplaceOrder(+order.axieId, wallet, provider, skymavisApyKey)

  if (receipt === false) {
    console.log('\x1b[33m%s\x1b[0m', 'The bot failed to execute the tx order')
    return false
  }

  console.log('\x1b[33m%s\x1b[0m', 'The bot executed the tx order successfully')
  const tx: string = receipt.transactionHash

  // TODO: validate if the tx failed, update the message with the error or the success

  // send a message to the discord channel if we've defined one
  if (process.env.BOT_CHANNEL_ID !== undefined) {
    console.log('\x1b[33m%s\x1b[0m', 'Sending message to discord channel')
    const embed = await getAxieEmbed(order.axieId, true)
    const exploreTxLink = `https://app.roninchain.com/tx/${tx}`
    void DiscordRequest(`/channels/${process.env.BOT_CHANNEL_ID}/messages`, {
      method: 'POST',
      body:
      {
        content: `Market order ${order.id} triggered`,
        tts: false,
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                label: 'Open Tx on Ronin explorer',
                style: 5,
                url: exploreTxLink
              }
            ]
          }
        ],
        embeds: [embed]
      }
    })
  }
}

export async function getAxieEstimatedPrice(axieData: IAxieData['data']['axie'], minPrice: string) {
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
  if (!ethers.BigNumber.isBigNumber(MIN_PRICE)) {
    throw new Error('Invalid min price')
  }
  // const marketMinPrice = String(await getMinPriceAxie(axieData.id))
  // console.log('marketMinPrice', marketMinPrice)

  let floorPrice = MIN_PRICE.toString()
  if (!ethers.BigNumber.isBigNumber(ethers.BigNumber.from(floorPrice))) {
    throw new Error('Invalid floor price')
  }

  if (similarMarketListings !== false) {
    // if few listed or virgin , multiply 3x the MIN_PRICE
    if (axieData.breedCount === 0 || similarMarketListings.total < 100) {
      floorPrice = MIN_PRICE.mul(3).toString()
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

export async function getAxieEmbed(axieId: string, resume = false) {
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
    content = content + `\nhttps://app.axieinfinity.com/marketplace/axies/${axie.id}`
  }

  if (!resume) {
    content = content + `\n\r**Parts:**\n${axie.parts.map((part) => `${part.type}: ${part.name} (${part.class})`).join('\n')}`
    // content = content + `\n\r**Origin Stats:**\n`
    content = content + `\n\r**Stats:**\n${Object.keys(axie.stats).map((key: string) => `${key}: ${axie.stats[key as keyof typeof axie.stats]}`).join('\n')}`
    content = content + `\n\r**Potential:**\n${Object.keys(axie.potentialPoints).filter((key: string) => axie.potentialPoints[key as keyof typeof axie.potentialPoints] > 0).map((key: string) => `${key}: ${axie.potentialPoints[key as keyof typeof axie.potentialPoints]}`).join('\n')}`
    content = content + `\n\r**Owner:** ${axie.ownerProfile?.name ?? 'Unknown'}`
    // content = content + `\nhttps://explorer.roninchain.com/address/ronin:${axie.owner.slice(2)}`
    content = content + `\nhttps://app.axieinfinity.com/profile/ronin:${axie.owner.slice(2)}`
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

export async function getAxieTransferHistory(axieId: string) {
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
  return res === null || res.data.axie === undefined ? null : res.data.axie
}

// const minPrice = ethers.BigNumber.from((await getMinPriceAxie(listing.id)))
// console.log(`minPrice: ${ethers.utils.formatEther(minPrice)}`)
export async function getMinPriceAxie(axieId: string) {
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
  return res === null || res.data.axie === undefined ? null : res.data.axie.minPrice
}
