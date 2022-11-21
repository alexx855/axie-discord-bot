
export interface IMarketOrder {
  id: string
  userId: string
  marketProps: MarketPropsInterface
  marketUrl: string
  triggerPrice: string
  floorPrice?: string
}
export interface IAsset {
  [key: string]: any
}

export interface IMarketBuyOrder {
  id: string
  axieId: string
  maker: string
  assets: IAsset[]
  basePrice: string
  triggerPrice: string
  currentPrice: string
  endedAt: string
  endedPrice: string
  expiredAt: string
  startedAt: string
  nonce: string
  signature: string
}

export interface MarketPropsInterface {
  classes?: string[]
  parts?: string[]
  breedCount?: string[]
  pureness?: string[]
  excludeParts?: string[]
  // [key: string]: any
}

export interface ICriteria {
  classes?: string[]
  parts?: string[]
  breedCount?: number[]
  pureness?: number[]
}

export interface IDiscordEmbed {
  title: string
  description: string
  thumbnail: {
    url: string
  }
  color: number
  type: string
}
