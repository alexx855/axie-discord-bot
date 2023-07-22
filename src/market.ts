import { IMarketOrder, IAsset, ICriteria } from './interfaces'
import { fetchAxieQuery, redisClient } from './utils'

export async function fetchMarketRecentlistings(variables = {
  from: 0,
  size: 1,
  sort: 'Latest',
  auctionType: 'Sale'
}) {
  const query = `query GetAxieLatest(
    $auctionType: AuctionType
    $criteria: AxieSearchCriteria
    $from: Int
    $sort: SortBy
    $size: Int
    $owner: String
  ) {
    axies(
      auctionType: $auctionType
      criteria: $criteria
      from: $from
      sort: $sort
      size: $size
      owner: $owner
    ) {
      total
      results {
        ...AxieRowData
        __typename
      }
      __typename
    }
  }
  
  fragment AxieRowData on Axie {
    id
    image
    class
    name
    genes
    owner
    class
    stage
    title
    breedCount
    newGenes
    battleInfo {
      banned
      __typename
    }
    parts {
      ...AxiePart
      __typename
    }
    stats {
      ...AxieStats
      __typename
    }
    order {
      ...OrderInfo
      __typename
    }
    __typename
  }
  
  fragment AxiePart on AxiePart {
    id
    name
    class
    type
    specialGenes
    stage
    abilities {
      ...AxieCardAbility
      __typename
    }
    __typename
  }
  
  fragment AxieCardAbility on AxieCardAbility {
    id
    name
    attack
    defense
    energy
    description
    backgroundUrl
    effectIconUrl
    __typename
  }
  
  fragment AxieStats on AxieStats {
    hp
    speed
    skill
    morale
    __typename
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
  }
  `

  interface IAxieLatestResponse {
    data?: {
      axies: {
        total: number
        results: Array<{
          id: string
          class: string
          order: {
            id: string
            maker: string
            kind: string
            assets: IAsset[]
            expiredAt: number
            paymentToken: string
            startedAt: number
            basePrice: string
            endedAt: number
            endedPrice: string
            expectedState: string
            nonce: string
            marketFeePercentage: string
            signature: string
            hash: string
            duration: number
            timeLeft: number
            currentPrice: string
            currentPriceUsd: string
          }
          breedCount: number
          parts: Array<{
            id: string
            name: string
            class: string
            type: string
          }>
        }>
      }
    }
    message?: string
    errors?: Array<{
      message: string
    }>
  }

  try {
    const res = await fetchAxieQuery<IAxieLatestResponse>(query, variables)
    // console.log(res)
    if (res === null || res.errors !== undefined || res.data === undefined) {
      console.log('error fetching latest listings', res)
      // throw new Error('error fetching latest listings')
      return false
    }
    return res.data.axies.results
  } catch (error) {
    console.log(error)
    return false
  }
}

export async function fetchMarketByCriteria(
  criteria: ICriteria,
  from = 0,
  size = 100,
  sort = 'Latest',
  auctionType?: string
) {
  // console.log('fetchMarket', marketOrder)
  const query = `
    query GetAxieBriefList(
      $auctionType: AuctionType
      $criteria: AxieSearchCriteria
      $from: Int
      $sort: SortBy
      $size: Int
      $owner: String
    ) {
      axies(
        auctionType: $auctionType
        criteria: $criteria
        from: $from
        sort: $sort
        size: $size
        owner: $owner
      ) {
        total
        results {
          id
          order {
            ... on Order {
              id
              maker
              kind
              assets {
                ... on Asset {
                  erc
                  address
                  id
                  quantity
                  orderId
                }
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
          }
        }
      }
    }
  `
  interface IAxieBriefListResult {
    data?: {
      axies: {
        total: number
        results: Array<{
          id: string
          order: {
            id: string
            maker: string
            kind: string
            assets: IAsset[]
            expiredAt: string
            paymentToken: string
            startedAt: string
            basePrice: string
            endedAt: string
            endedPrice: string
            expectedState: string
            nonce: string
            marketFeePercentage: string
            signature: string
            hash: string
            duration: string
            timeLeft: string
            currentPrice: string
            suggestedPrice: string
            currentPriceUsd: string
          }
        }>
      }
    }
    message?: string
    errors?: Array<{
      message: string // ???
    }>
  }
  const variables: {
    from: number
    size: number
    sort: string
    criteria: ICriteria
    auctionType?: string
  } = {
    from,
    size,
    sort,
    criteria
  }

  if (auctionType !== undefined) {
    variables.auctionType = auctionType
  }

  // get results from the market
  const res = await fetchAxieQuery<IAxieBriefListResult>(query, variables)
  // console.log('res', res)
  if (res === null || res.errors !== undefined || res.data === undefined) {
    console.log('error fetching market by criteria', res)
    // { message: 'API rate limit exceeded' }
    if ((res != null) && res.message === 'API rate limit exceeded') {
      // wait for 10 secs
      await new Promise(resolve => setTimeout(resolve, 10000))
    }

    // throw new Error('error fetching market by criteria')
    return false
  }
  return res.data.axies
}

export async function getLastestAxieListingId() {
  await redisClient.connect()
  const lastId = await redisClient.get('LastestAxieListingId')
  await redisClient.disconnect()
  return lastId ?? ''
}

export async function setMostRecentlistingAxieId(axieId: string) {
  await redisClient.connect()
  await redisClient.set('LastestAxieListingId', axieId)
  await redisClient.disconnect()
}

export async function getRedisMarketOrders() {
  const ordersArray: IMarketOrder[] = []
  await redisClient.connect()

  const orders = await redisClient.get('orders')
  await redisClient.disconnect()
  if (orders !== null) {
    ordersArray.push(...JSON.parse(orders))
  }

  return ordersArray
}

export async function setMarketOrders(orders: IMarketOrder[]) {
  await redisClient.connect()
  await redisClient.set('orders', JSON.stringify(orders))
  await redisClient.disconnect()
}

export async function updateMarketOrder(order: IMarketOrder) {
  await redisClient.connect()
  const orders = await redisClient.get('orders')
  if (orders !== null) {
    const ordersArray = JSON.parse(orders)
    const index = ordersArray.findIndex((o: IMarketOrder) => o.id === order.id)
    if (index !== -1) {
      ordersArray[index] = order
    }
    await redisClient.set('orders', JSON.stringify(ordersArray))
  }
  await redisClient.disconnect()
}

export async function addMarketOrder(newOrder: IMarketOrder) {
  const orders = await getRedisMarketOrders()
  await setMarketOrders([...orders, newOrder])
}

export async function removeMarketOrder(orderId: string) {
  const orders = await getRedisMarketOrders()
  // Check if order exists
  const orderIndex = orders.findIndex(order => order.id === orderId)
  if (orderIndex !== -1) {
    // Remove the order
    orders.splice(orderIndex, 1)
    // Set the new orders
    await setMarketOrders(orders)
  }
}
