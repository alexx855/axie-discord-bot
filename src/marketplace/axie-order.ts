import { apiRequest } from '../utils'
import { GRAPHQL_URL } from '../constants'

interface Axie {
  id: string
  order: Order
  __typename: string
}

interface Order {
  id: number
  maker: string
  kind: string
  assets: Asset[]
  expiredAt: number
  paymentToken: string
  startedAt: number
  basePrice: string
  endedAt: number
  endedPrice: string
  expectedState: string
  nonce: number
  marketFeePercentage: number
  signature: string
  hash: string
  duration: number
  timeLeft: number
  currentPrice: string
  suggestedPrice: string
  currentPriceUsd: string
  __typename: string
}

interface Asset {
  erc: string
  address: string
  id: string
  quantity: string
  orderId: number
  __typename: string
}

interface IGetAxieDetail {
  data?: {
    axie: Axie
  }
  errors?: {
    message: string
  }
}

export async function getAxieMarketplaceOrder (axieId: string) {
  if (process.env.SKIMAVIS_DAPP_KEY === undefined) {
    throw new Error('Skymavis Dapp key is undefined')
  }

  const query = `query GetAxieDetail($axieId: ID!) {
        axie(axieId: $axieId) {
          ...AxieDetail
          __typename
        }
      }
      fragment AxieDetail on Axie {
        id
        order {
          ...OrderInfo
          __typename
        }
      }

      fragment OrderInfo on Order {
        id
        maker
        kind
        assets {
          ...AssetInfo
          __typename
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
        __typename
      }
      fragment AssetInfo on Asset {
        erc
        address
        id
        quantity
        orderId
        __typename
      }`

  const variables = {
    axieId
  }

  const headers = {
    'x-api-key': process.env.SKIMAVIS_DAPP_KEY
  }

  const results = await apiRequest<IGetAxieDetail>(GRAPHQL_URL, JSON.stringify({ query, variables }), headers)
  const order = results.data?.axie?.order
  return order || null
}
