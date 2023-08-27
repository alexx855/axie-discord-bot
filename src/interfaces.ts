
export interface IMarketOrder {
  id: string
  userId: string
  marketProps: MarketPropsInterface
  marketUrl: string
  triggerPrice: string
  floorPrice?: string
}

// todo: complete interface
export interface IAsset {
  [key: string]: any
}

export interface IMarketBuyOrder {
  id: string
  axieId: string
  maker: string
  assets: IAsset[]
  basePrice: string
  currentPrice: string
  endedAt: string
  endedPrice: string
  expiredAt: string
  startedAt: string
  nonce: string
  signature: string
}

export interface ICriteria {
  classes?: string[]
  parts?: string[]
  breedCount?: number[]
  pureness?: number[]
}

export interface MarketPropsInterface extends ICriteria {
  excludeParts?: string[]
  // [key: string]: any
}

export interface IDiscordEmbed {
  title?: string
  description?: string
  type?: string
  thumbnail?: {
    url: string
  }
  color?: number
}

export interface IScalpedAxie {
  axieId: string
  class: string
  parts: Array<{
    id: string
    name: string
    class: string
    type: string
  }>
  currentPrice: string
  floorPrice: string
  profit: string
  breedCount: number
  totalOnSale: number
  totalAxies: number
  estimatedPercentage: number
  rarity: 'Common' | 'Rare' | 'Epic' | 'Unique'
  pureness: number
  lastSoldPrice?: string
  lastSoldDate?: string
}

export interface IAxieData {
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
