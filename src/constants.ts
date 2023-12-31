import { defineChain } from 'viem'

import * as dotenv from 'dotenv'
dotenv.config()

if (process.env.SKIMAVIS_DAPP_KEY === undefined) {
  throw new Error('Skimavis dapp key is undefined')
}

export const AUTH_NONCE_URL = 'https://athena.skymavis.com/v2/public/auth/ronin/fetch-nonce'
export const AUTH_LOGIN_URL = 'https://athena.skymavis.com/v2/public/auth/ronin/login'
export const AUTH_TOKEN_REFRESH_URL = 'https://athena.skymavis.com/v2/public/auth/token/refresh' // default gas limit for track usage

export const GRAPHQL_URL = 'https://graphql-gateway.axieinfinity.com/graphql'
export const DEFAULT_GAS_LIMIT = 481338

export const RONIN_CHAIN = defineChain({
  id: 2020,
  name: 'Ronin',
  network: 'ronin',
  nativeCurrency: {
    decimals: 18,
    name: 'RON',
    symbol: 'RON'
  },
  rpcUrls: {
    public: {
      http: [`https://api-gateway.skymavis.com/rpc?apikey=${process.env.SKIMAVIS_DAPP_KEY}`]
    },
    default: { http: [`https://api-gateway.skymavis.com/rpc?apikey=${process.env.SKIMAVIS_DAPP_KEY}`] }
  },
  blockExplorers: {
    default: { name: 'Ronin Explorer', url: 'https://app.roninchain.com/' }
  }
})

// Command that returns custom axie data
export const BUY_AXIE_COMMAND = {
  name: 'axie_buy',
  description: 'Buy axie from the marketplace',
  options: [
    {
      name: 'axie_id',
      description: 'Axie ID',
      type: 3,
      required: true
    }
  ],
  type: 1
}

export const CREATE_AXIE_SALE_COMMAND = {
  name: 'axie_sale',
  description: 'List axie for sale on the marketplace',
  options: [
    {
      name: 'axie_id',
      description: 'Axie ID',
      type: 3,
      required: true
    },
    {
      name: 'base_price',
      description: 'Base price',
      type: 3,
      required: true
    },
    {
      name: 'ended_price',
      description: 'Ended price',
      type: 3,
      required: false
    },
    {
      name: 'duration',
      description: 'Duration',
      type: 3,
      required: false
    }
  ],
  type: 1
}

export const CREATE_AXIE_SALE_ALL_COMMAND = {
  name: 'axie_sale_all',
  description: 'List all axie for sale on the marketplace',
  options: [
    {
      name: 'base_price',
      description: 'Base price',
      type: 3,
      required: true
    },
    {
      name: 'ended_price',
      description: 'Ended price',
      type: 3,
      required: false
    },
    {
      name: 'duration',
      description: 'Duration',
      type: 3,
      required: false
    }
  ],
  type: 1
}

export const CANCEL_AXIE_SALE_COMMAND = {
  name: 'axie_cancel_sale',
  description: 'Unlist axie from the marketplace',
  options: [
    {
      name: 'axie_id',
      description: 'Axie ID',
      type: 3,
      required: true
    }
  ],
  type: 1
}
export const CANCEL_AXIE_SALE_ALL_COMMAND = {
  name: 'axie_cancel_sale_all',
  description: 'Unlist all axies from the marketplace',
  type: 1
}

export const TRANSFER_AXIE_COMMAND = {
  name: 'axie_transfer',
  description: 'Transfer axie to another address',
  options: [
    {
      name: 'axie_id',
      description: 'Axie ID',
      type: 3,
      required: true
    },
    {
      name: 'address',
      description: 'Address',
      type: 3,
      required: true
    }
  ],
  type: 1
}

export const TRANSFER_AXIE_ALL_COMMAND = {
  name: 'axie_transfer_all',
  description: 'Transfer all axies to another address',
  options: [
    {
      name: 'address',
      description: 'Address',
      type: 3,
      required: true
    }
  ],
  type: 1
}

export const WALLET_COMMAND = {
  name: 'wallet',
  description: 'Get bot ronin WALLET details',
  type: 1
}

export const AXIE_INFO_COMMAND = {
  name: 'axie_info',
  description: 'Get axie info',
  options: [
    {
      name: 'axie_id',
      description: 'Axie ID',
      type: 3,
      required: true
    }
  ]
}

// Commands for the sniper orders management
export const GET_ORDERS_COMMAND = {
  name: 'orders',
  description: 'Get open bot orders',
  type: 1
}

export const REMOVE_ORDER_COMMAND = {
  name: 'remove_order',
  description: 'Remove open bot order',
  options: [
    {
      name: 'order_id',
      description: 'Order ID',
      type: 3,
      required: true
    }
  ],
  type: 1
}

export const ADD_ORDER_COMMAND = {
  name: 'add_order',
  description: 'Add bot order',
  type: 1
}

export const OPEN_EXPLORER_APP_LABEL = 'Open TX on Ronin Explorer'
export const OPEN_MARKETPLACE_APP_LABEL = 'Open Axie Marketplace'
