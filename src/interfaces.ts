export interface IMarketOrder {
  id: string
  marketUrl: string
  triggerPrice: string
  floorPrice?: string
  totalOnSale?: number
  totalExistence?: number
}

// todo: complete interface
export type IAsset = Record<string, any>

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

export interface IMarketProps extends ICriteria {
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

export interface IMarketAsset {
  axieId: string
  class: string
  parts: Array<{
    id: string
    name: string
    class: string
    type: string
  }>
  currentPrice: string
  resellEstProfit: string
  breedCount: number
  floorPrice: string
  totalOnSale: number
  totalExistence: number
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
