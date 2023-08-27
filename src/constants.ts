export const CONTRACT_AXIE_ADDRESS = '0x32950db2a7164ae833121501c797d79e7b79d74c'
export const CONTRACT_AXIE_ABI_JSON_PATH = 'abis/axie.json'

export const CONTRACT_SLP_ADDRESS = '0xa8754b9fa15fc18bb59458815510e40a12cd2014'
export const CONTRACT_SLP_ABI_JSON_PATH = 'abis/slp.json'

export const CONTRACT_WETH_ADDRESS = '0xc99a6a985ed2cac1ef41640596c5a5f9f4e19ef5'
export const CONTRACT_WETH_ABI_JSON_PATH = 'abis/weth.json'

export const CONTRACT_AXS_ADDRESS = '0x97a9107c1793bc407d6f527b77e7fff4d812bece'
export const CONTRACT_AXS_ABI_JSON_PATH = 'abis/axs.json'

export const CONTRACT_RUNE_ADDRESS = '0xc25970724f032af21d801978c73653c440cf787c'
export const CONTRACT_RUNE_ABI_JSON_PATH = 'abis/rune.json'

export const CONTRACT_CHARM_ADDRESS = '0x814a9c959a3ef6ca44b5e2349e3bba9845393947'
export const CONTRACT_CHARM_ABI_JSON_PATH = 'abis/charm.json'

export const CONTRACT_AXIE_GENES_BREWER_ADDRESS = '0x54e91daf9362900f94d32bd084beff4bdb73ea62'
export const CONTRACT_AXIE_GENES_BREWER_ABI_JSON_PATH = 'abis/genes_brewer.json'

export const CONTRACT_MULTICALL_ADDRESS = '0xc76d0d0d3aa608190f78db02bf2f5aef374fc0b9'
export const CONTRACT_MULTICALL_ABI_JSON_PATH = 'abis/multicall.json'

export const CONTRACT_ERC721_BATCH_TRANSFER_ADDRESS = '0x2368dfed532842db89b470fde9fd584d48d4f644'
export const CONTRACT_ERC721_BATCH_TRANSFER_ABI_JSON_PATH = 'abis/erc721_batch_transfer.json'

export const CONTRACT_MARKETPLACE_V2_ADDRESS = '0xfff9ce5f71ca6178d3beecedb61e7eff1602950e'
export const CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH = 'abis/market_v2.json'

export const GRAPHQL_URL = 'https://graphql-gateway.axieinfinity.com/graphql'
export const DEFAULT_GAS_LIMIT = 481338 // default gas limit for track usage

// Command that returns custom axie data, like estimated price
export const AXIE_COMMAND = {
  name: 'axie',
  description: 'Get custom axie data by ID',
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

// Commands for ronin
export const LIST_AXIE_COMMAND = {
  name: 'list_axie',
  description: 'List axie for sale on the marketplace',
  options: [
    {
      name: 'axie_id',
      description: 'Axie ID',
      type: 3,
      required: true,
    },
    {
      name: 'base_price',
      description: 'Base price',
      type: 3,
      required: true,
    },
    {
      name: 'ended_price',
      description: 'Ended price',
      type: 3,
      required: false,
    },
    {
      name: 'duration',
      description: 'Duration',
      type: 3,
      required: false,
    }
  ],
  type: 1
}

export const UNLIST_AXIE_COMMAND = {
  name: 'unlist_axie',
  description: 'Unlist axie from the marketplace',
  options: [
    {
      name: 'axie_id',
      description: 'Axie ID',
      type: 3,
      required: true,
    }
  ],
  type: 1
}

export const TRANSFER_AXIE_COMMAND = {
  name: 'transfer_axie',
  description: 'Transfer axie to another address',
  options: [
    {
      name: 'axie_id',
      description: 'Axie ID',
      type: 3,
      required: true,
    },
    {
      name: 'address',
      description: 'Address',
      type: 3,
      required: true,
    }
  ],
  type: 1
}

export const TRANSFER_ALL_AXIES_COMMAND = {
  name: 'transfer_all_axies',
  description: 'Transfer all axies to another address',
  options: [
    {
      name: 'address',
      description: 'Address',
      type: 3,
      required: true,
    }
  ],
  type: 1
}

export const RONIN_WALLET_COMMAND = {
  name: 'ronin_wallet',
  description: 'Get bot ronin WALLET details',
  type: 1
}

// Commands for the sniper orders management
export const GET_ORDERS_COMMAND = {
  name: 'get_orders',
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
