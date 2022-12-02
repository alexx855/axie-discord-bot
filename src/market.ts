import { IMarketOrder, IAsset, ICriteria } from './interfaces'
import { fetchAxieQuery, redisClient } from './utils'

export async function fetchMarketRecentlistings() {
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
    level
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
  // todo: refactor as default params so i can change the size and from
  const variables = {
    from: 0,
    size: 5,
    sort: 'Latest',
    auctionType: 'Sale'
  }

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

export async function getMarketOrders() {
  const ordersArray: IMarketOrder[] = []
  await redisClient.connect()

  const orders = await redisClient.get('orders')
  if (orders !== null) {
    ordersArray.push(...JSON.parse(orders))
  }

  await redisClient.disconnect()
  return ordersArray
}

export async function getMostRecentlistingsAxieId() {
  await redisClient.connect()
  const lastId = await redisClient.get('MostRecentlistingsAxieId')
  await redisClient.disconnect()
  return lastId ?? ''
}

export async function setMostRecentlistingsAxieId(axieId: string) {
  await redisClient.connect()
  await redisClient.set('MostRecentlistingsAxieId', axieId)
  await redisClient.disconnect()
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
  const orders = await getMarketOrders()
  await setMarketOrders([...orders, newOrder])
}

export async function removeMarketOrder(orderId: string) {
  const orders = await getMarketOrders()
  // Check if order exists
  const orderIndex = orders.findIndex(order => order.id === orderId)
  if (orderIndex !== -1) {
    // Remove the order
    orders.splice(orderIndex, 1)
    // Set the new orders
    await setMarketOrders(orders)
  }
}

export async function getRecentlyAxiesSold(from: number = 0, size: number = 20) {
  const query = ':"query GetRecentlyAxiesSold($from: Int, $size: Int) {\n\tsettledAuctions {\n\t\taxies(from: $from, size: $size) {\n\t\t\ttotal\n\t\t\tresults {\n\t\t\t\t...AxieBrief\n\t\t\t\ttransferHistory {\n\t\t\t\t\t...TransferHistoryInSettledAuction\n\t\t\t\t\t__typename\n\t\t\t\t}\n\t\t\t\t__typename\n\t\t\t}\n\t\t\t__typename\n\t\t}\n\t\t__typename\n\t}\n}\n\nfragment AxieBrief on Axie {\n\tid\n\tname\n\tstage\n\tclass\n\tbreedCount\n\timage\n\ttitle\n\tgenes\n\tnewGenes\n\tbattleInfo {\n\t\tbanned\n\t\t__typename\n\t}\n\torder {\n\t\tid\n\t\tcurrentPrice\n\t\tcurrentPriceUsd\n\t\t__typename\n\t}\n\tparts {\n\t\tid\n\t\tname\n\t\tclass\n\t\ttype\n\t\tspecialGenes\n\t\t__typename\n\t}\n\t__typename\n}\n\nfragment TransferHistoryInSettledAuction on TransferRecords {\n\ttotal\n\tresults {\n\t\t...TransferRecordInSettledAuction\n\t\t__typename\n\t}\n\t__typename\n}\n\nfragment TransferRecordInSettledAuction on TransferRecord {\n\tfrom\n\tto\n\ttxHash\n\ttimestamp\n\twithPrice\n\twithPriceUsd\n\tfromProfile {\n\t\tname\n\t\t__typename\n\t}\n\ttoProfile {\n\t\tname\n\t\t__typename\n\t}\n\t__typename\n}\n"'
  const variables = { from, size, sort: 'Latest', auctionType: 'Sale' }
  // { data: { settledAuctions: { axies { total: Number, results: Array<{ id: string, name: string, stage: Number, class: string, breedCount: Number, image: string, title: string, genes: string, newGenes: string, battleInfo: { banned: boolean }, order: { id: string, currentPrice: string, currentPriceUsd: string }, parts: Array<{ id: string, name: string, class: string, type: string, specialGenes: string }>, transferHistory: { total: Number, results: Array<{ from: string, to: string, txHash: string, timestamp: Number, withPrice: string, withPriceUsd: string, fromProfile: { name: string }, toProfile: { name: string } }> } }> }
  interface IGetRecentlyAxiesSold {
    settledAuctions: {
      axies: {
        total: number
        results: Array<{
          id: string
          name: string
          stage: number
          class: string
          breedCount: number
          image: string
          title: string
          genes: string
          newGenes: string
          battleInfo: {
            banned: boolean
          }
          order: {
            id: string
            currentPrice: string
            currentPriceUsd: string
          }
          parts: Array<{
            id: string
            name: string
            class: string
            type: string
            specialGenes: string
          }>
          transferHistory: {
            total: number
            results: Array<{
              from: string
              to: string
              txHash: string
              timestamp: number
              withPrice: string
              withPriceUsd: string
              fromProfile: {
                name: string
              }
              toProfile: {
                name: string
              }
            }>
          }
        }>
      }
    }
  }
  const res = await fetchAxieQuery<IGetRecentlyAxiesSold>(query, variables)
  if (res === null || res.errors !== undefined || res.data === undefined) {
    console.log('error fetching axies sold', res)
    throw new Error('error fetching axies sold')
  }
  return res.data.settledAuctions.axies.results
}
