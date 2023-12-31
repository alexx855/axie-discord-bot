import { InteractionResponseType } from 'discord-interactions'
import { RONIN_CHAIN, OPEN_EXPLORER_APP_LABEL, AUTH_LOGIN_URL, AUTH_NONCE_URL, AUTH_TOKEN_REFRESH_URL, GRAPHQL_URL } from '../constants'
import { getAxieMarketplaceOrder } from '../marketplace/axie-order'
import { isHex, encodeFunctionData, createWalletClient, http, createPublicClient, parseEther, WalletClient, PublicClient, encodeAbiParameters, parseAbiParameters } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { apiRequest, roninAddress } from '../../src/utils'
import { APP_AXIE_ORDER_EXCHANGE, AXIE_PROXY, MARKETPLACE_GATEWAY_V2, MARKET_GATEWAY, WRAPPED_ETHER } from '@roninbuilders/contracts'
import { getAxieIdsFromAddress } from '../axies'

export const checkAndApproveAllowance = async (publicClient: PublicClient, walletClient: WalletClient) => {
  if (walletClient.account === undefined) {
    throw new Error('Wallet client account not set')
  }

  const address = walletClient.account.address

  // check if the marketplace contract has enough WETH allowance
  const allowance = await publicClient.readContract({
    address: WRAPPED_ETHER.address,
    abi: WRAPPED_ETHER.abi,
    functionName: 'allowance',
    args: [address, MARKETPLACE_GATEWAY_V2.address]
  }) as boolean

  // msg.sender has to call setApprovalForAll on _tokenContract to authorize this contract.
  const approvalReceiptTotalCost: bigint = 0n
  let approvalTxHash: `0x${string}` | null = null
  if (!allowance) {
    // Need approve the marketplace contract to transfer WETH, no allowance
    const amountToapprove = '115792089237316195423570985008687907853269984665640564039457584007913129639935' // same amount as the ronin wallet uses, i got it from there
    const { request: approvalRequest } = await publicClient.simulateContract({
      account: walletClient.account,
      address: WRAPPED_ETHER.address,
      abi: WRAPPED_ETHER.abi,
      functionName: 'approve',
      args: [MARKETPLACE_GATEWAY_V2.address, amountToapprove]
    })

    approvalTxHash = await walletClient.writeContract(approvalRequest)
    const approvalReceipt = await publicClient.waitForTransactionReceipt(
      {
        confirmations: 2,
        hash: approvalTxHash,
        onReplaced: replacement => console.log(replacement),
        pollingInterval: 1_000,
        timeout: 30_000
      }
    )
    const approvalReceiptTotalCost = approvalReceipt.gasUsed * approvalReceipt.effectiveGasPrice
    console.log(`Approval receipt total cost: ${approvalReceiptTotalCost}`)
  }
  return { allowance, approvalTxHash, approvalReceiptTotalCost }
}

export const checkAndApproveMarketplace = async (publicClient: PublicClient, walletClient: WalletClient) => {
  if (walletClient.account === undefined) {
    throw new Error('Wallet client account not set')
  }

  const address = walletClient.account.address

  // check if the marketplace contract has enough WETH allowance
  const allowance = await publicClient.readContract({
    address: WRAPPED_ETHER.address,
    abi: WRAPPED_ETHER.abi,
    functionName: 'allowance',
    args: [address, MARKETPLACE_GATEWAY_V2.address]
  }) as boolean

  // msg.sender has to call setApprovalForAll on _tokenContract to authorize this contract.
  const approvalReceiptTotalCost: bigint = 0n
  let approvalTxHash: `0x${string}` | null = null
  if (!allowance) {
    // Need approve the marketplace contract to transfer WETH, no allowance
    const amountToapprove = '115792089237316195423570985008687907853269984665640564039457584007913129639935' // same amount as the ronin wallet uses, i got it from there
    const { request: approvalRequest } = await publicClient.simulateContract({
      account: walletClient.account,
      address: WRAPPED_ETHER.address,
      abi: WRAPPED_ETHER.abi,
      functionName: 'approve',
      args: [MARKETPLACE_GATEWAY_V2.address, amountToapprove]
    })

    approvalTxHash = await walletClient.writeContract(approvalRequest)
    const approvalReceipt = await publicClient.waitForTransactionReceipt(
      {
        confirmations: 2,
        hash: approvalTxHash,
        onReplaced: replacement => console.log(replacement),
        pollingInterval: 1_000,
        timeout: 30_000
      }
    )
    const approvalReceiptTotalCost = approvalReceipt.gasUsed * approvalReceipt.effectiveGasPrice
    console.log(`Approval receipt total cost: ${approvalReceiptTotalCost}`)
  }
  return { allowance, approvalTxHash, approvalReceiptTotalCost }
}

export const sellAxieCommandHandler = async (
  axieId: string,
  basePrice: string,
  endedPrice: string = '0',
  duration: number = 30 // Duration in days
) => {
  console.log(`Sell axie ${axieId} for ${basePrice} ETH with an end price of ${endedPrice} ETH and a duration of ${duration !== undefined ? duration.toString() + ' days' : '6 months'} `)
  if (process.env.PRIVATE_KEY === undefined || !isHex(process.env.PRIVATE_KEY)) {
    throw new Error('Private key not valid, check .env file, should start with 0x')
  }
  try {
    // Get order from marketplace
    const order = await getAxieMarketplaceOrder(axieId)
    if (order === undefined) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: 'Error creating sale',
            description: 'Invalid order',
            color: 0xff0000 // Red color
          }]
        }
      }
    }

    // get account from private key
    const account = privateKeyToAccount(process.env.PRIVATE_KEY)
    const { address } = account

    const walletClient = createWalletClient({
      account,
      chain: RONIN_CHAIN,
      transport: http()
    })

    const startedAt = Math.floor(Date.now() / 1000)
    let endedAt = 0
    if (endedPrice !== '0') {
      // 86400 seconds in a day, one day as default like the marketplace
      endedAt = startedAt + 86400 * duration
    }

    // ~ 6 months max listing duration
    const expiredAt = startedAt + 15634800

    // Create the order
    const types = {
      Asset: [
        {
          name: 'erc',
          type: 'uint8'
        },
        {
          name: 'addr',
          type: 'address'
        },
        {
          name: 'id',
          type: 'uint256'
        },
        {
          name: 'quantity',
          type: 'uint256'
        }
      ],
      Order: [
        {
          name: 'maker',
          type: 'address'
        },
        {
          name: 'kind',
          type: 'uint8'
        },
        {
          name: 'assets',
          type: 'Asset[]'
        },
        {
          name: 'expiredAt',
          type: 'uint256'
        },
        {
          name: 'paymentToken',
          type: 'address'
        },
        {
          name: 'startedAt',
          type: 'uint256'
        },
        {
          name: 'basePrice',
          type: 'uint256'
        },
        {
          name: 'endedAt',
          type: 'uint256'
        },
        {
          name: 'endedPrice',
          type: 'uint256'
        },
        {
          name: 'expectedState',
          type: 'uint256'
        },
        {
          name: 'nonce',
          type: 'uint256'
        },
        {
          name: 'marketFeePercentage',
          type: 'uint256'
        }
      ]
    } as const

    const domain = {
      name: 'MarketGateway',
      version: '1',
      chainId: 2020,
      verifyingContract: MARKETPLACE_GATEWAY_V2.address
    } as const

    const message = {
      maker: address,
      kind: 1,
      assets: [
        {
          erc: 1,
          addr: AXIE_PROXY.address,
          id: BigInt(axieId),
          quantity: 0n
        }
      ],
      expiredAt: BigInt(expiredAt),
      paymentToken: WRAPPED_ETHER.address,
      startedAt: BigInt(startedAt),
      basePrice: BigInt(parseEther(basePrice)),
      endedAt: BigInt(endedAt),
      endedPrice: BigInt(parseEther(endedPrice)),
      expectedState: 0n,
      nonce: 0n,
      marketFeePercentage: 425n
    } as const

    const signature = await walletClient.signTypedData({
      domain,
      types,
      primaryType: 'Order',
      message
    })

    const query = `
        mutation CreateOrder($order: InputOrder!, $signature: String!) {
    createOrder(order: $order, signature: $signature) {
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
}
      `
    const variables = {
      order: {
        nonce: Number(message.nonce),
        assets: [
          {
            erc: 'Erc721',
            address: message.assets[0].addr,
            id: message.assets[0].id.toString(),
            quantity: message.assets[0].quantity.toString()
          }
        ],
        basePrice: message.basePrice.toString(),
        endedPrice: message.endedPrice.toString(),
        startedAt: Number(message.startedAt),
        endedAt: Number(message.endedAt),
        expiredAt: Number(message.expiredAt)
      },
      signature
    }

    console.log('variables:', variables.order)

    // Exchange the signature for an access token
    const accessTokenMessage = await generateAccessTokenMessage(address)
    const accessTokenSignature = await walletClient.signMessage({
      account,
      message: accessTokenMessage
    })
    const { accessToken } = await exchangeToken(accessTokenSignature, accessTokenMessage)

    const headers = {
      authorization: `Bearer ${accessToken}`
      // 'x-api-key':  process.env.SKIMAVIS_DAPP_KEY
    }

    interface ICreateOrderResult {
      data?: {
        createOrder: {
          hash: string
        }
      }
      errors?: Array<{
        message: string
      }>
    }

    const result = await apiRequest<ICreateOrderResult>(GRAPHQL_URL, JSON.stringify({ query, variables }), headers)
    console.log('result:', result)
    if (result.errors !== undefined) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: 'Error creating sale',
            description: result.errors[0].message,
            color: 0xff0000 // Red color
          }]
        }
      }
    }

    // Send a message into the channel where command was triggered from
    const description = `Axie #${axieId} listed for sale at ${basePrice} ETH ${endedPrice !== '0' ? `with an end price of ${endedPrice} ETH` : ''} ${duration !== undefined ? `and a duration of ${duration} days` : ''}`
    console.log(description)
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: 'Sale created',
          description,
          type: 'rich'
        }]
      }
    }
  } catch (error) {
    console.log(error)
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: 'Error creating sale',
          description: (error as any).shortMessage ?? 'Unknown error',
          color: 0xff0000 // Red color
        }]
      }
    }
  }
}

export const cancelSaleAxieCommandHandler = async (axieId: string) => {
  console.log(`Cancel sale axie ${axieId}`)
  // const txBuyAxie = await marketplaceContract.interactWith('ORDER_EXCHANGE', encodedOrderData)
  if (process.env.PRIVATE_KEY === undefined || !isHex(process.env.PRIVATE_KEY)) {
    throw new Error('Private key not valid, check .env file, should start with 0x')
  }
  try {
    // Get order from marketplace
    const order = await getAxieMarketplaceOrder(axieId)
    if (order === undefined) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: 'Error cancelling sale',
            description: 'Invalid order',
            color: 0xff0000 // Red color
          }]
        }
      }
    }

    // get account from private key
    const account = privateKeyToAccount(process.env.PRIVATE_KEY)

    const walletClient = createWalletClient({
      account,
      chain: RONIN_CHAIN,
      transport: http()
    })

    const publicClient = createPublicClient({
      chain: RONIN_CHAIN,
      transport: http()
    })

    // Recreate the order
    const orderTypes = '(address maker, uint8 kind, (uint8 erc,address addr,uint256 id,uint256 quantity)[] assets, uint256 expiredAt, address paymentToken, uint256 startedAt, uint256 basePrice, uint256 endedAt, uint256 endedPrice, uint256 expectedState, uint256 nonce, uint256 marketFeePercentage)'
    const orderData = {
      maker: order.maker as `0x${string}`,
      kind: 1,
      assets: [
        {
          erc: 1,
          addr: order.assets[0].address as `0x${string}`,
          id: BigInt(order.assets[0].id),
          quantity: BigInt(order.assets[0].quantity)
        }
      ],
      expiredAt: BigInt(order.expiredAt),
      paymentToken: WRAPPED_ETHER.address,
      startedAt: BigInt(order.startedAt),
      basePrice: BigInt(order.basePrice),
      endedAt: BigInt(order.endedAt),
      endedPrice: BigInt(order.endedPrice),
      expectedState: 0n,
      nonce: BigInt(order.nonce),
      marketFeePercentage: 425n
    }
    const encodedOrderData = encodeAbiParameters(
      parseAbiParameters(orderTypes),
      [orderData]
    )

    const cancelOrderExchangeData = encodeFunctionData({
      abi: APP_AXIE_ORDER_EXCHANGE.abi,
      functionName: 'cancelOrder',
      args: [encodedOrderData]
    })

    // marketplace order exchange
    const { request } = await publicClient.simulateContract({
      account,
      address: MARKETPLACE_GATEWAY_V2.address,
      abi: MARKET_GATEWAY.abi,
      functionName: 'interactWith',
      args: ['ORDER_EXCHANGE', cancelOrderExchangeData]
    })

    const txHash = await walletClient.writeContract(request)

    // Send a message into the channel where command was triggered from
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Sale cancelled:\n',
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                label: OPEN_EXPLORER_APP_LABEL,
                style: 5,
                url: `https://app.roninchain.com/tx/${txHash as string}`
              }
            ]
          }
        ],
        embeds: [{
          title: 'Sale cancelled',
          description: `Axie #${axieId} sale cancelled`,
          type: 'rich'
        }
        ]
      }
    }
  } catch (error) {
    console.log(error)
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: 'Error cancelling sale',
          description: (error as any).shortMessage ?? 'Unknown error',
          color: 0xff0000 // Red color
        }]
      }
    }
  }
}

export const sellAllAxiesCommandHandler = async (basePrice: string, endedPrice?: string, duration?: number) => {
  if (process.env.PRIVATE_KEY === undefined || !isHex(process.env.PRIVATE_KEY)) {
    throw new Error('Private key not valid, check .env file, should start with 0x')
  }

  const account = privateKeyToAccount(process.env.PRIVATE_KEY)
  const { address } = account
  console.log(`Sell all axies from ${address}`)

  const publicClient = createPublicClient({
    chain: RONIN_CHAIN,
    transport: http()
  })

  try {
    // Get all axies from address
    getAxieIdsFromAddress(address, publicClient)
      .then(async (axiesIds) => {
        // Sell all axies
        for (const axieId of axiesIds) {
          try {
            await sellAxieCommandHandler(axieId.toString(), basePrice, endedPrice, duration)
          } catch (error) {
            console.log(`Error listing axie ${axieId}`)
          }
        }
      })
      .catch((error) => {
        console.log(`Error getting axies from ${address}`, error)
      })

    // Send a message into the channel where command was triggered from
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [
          {
            title: `Selling all axies in ${address}`,
            description: `**Price:** ${basePrice} WETH ${endedPrice !== undefined ? `**End price:** ${endedPrice} WETH` : ''} ${duration !== undefined ? `**Duration:** ${duration} days` : ''}`
          }
        ]
      }
    }
  } catch (error) {
    console.log(error)
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: 'Error selling all axies',
          description: (error as any).shortMessage ?? 'Unknown error',
          color: 0xff0000 // Red color
        }]
      }
    }
  }
}

export const cancelAllAxieSalesCommandHandler = async () => {
  if (process.env.PRIVATE_KEY === undefined || !isHex(process.env.PRIVATE_KEY)) {
    throw new Error('Private key not valid, check .env file, should start with 0x')
  }

  const account = privateKeyToAccount(process.env.PRIVATE_KEY)
  const { address } = account
  console.log(`Cancel all axie sales from ${address}`)

  const publicClient = createPublicClient({
    chain: RONIN_CHAIN,
    transport: http()
  })

  try {
    // Get all axies from address
    getAxieIdsFromAddress(address, publicClient)
      .then(async (axiesIds) => {
        // Sell all axies
        for (const axieId of axiesIds) {
          try {
            await cancelSaleAxieCommandHandler(axieId.toString())
          } catch (error) {
            console.log(`Error cancelling axie ${axieId} sale`)
          }
        }
      })
      .catch((error) => {
        console.log(`Error getting axies from ${address}`, error)
      })

    // Send a message into the channel where command was triggered from
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [
          {
            title: `Cancelling all axie sales in ${roninAddress(address)}`
          }
        ]
      }
    }
  } catch (error) {
    console.log(error)
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: 'Error while cancelling all axie sales',
          description: (error as any).shortMessage ?? 'Unknown error',
          color: 0xff0000 // Red color
        }]
      }
    }
  }
}

// Taken from https://github.com/SM-Trung-Le/temp-accessToken
export const generateAccessTokenMessage = async (
  address: string,
  domain = 'discord.alexpedersen.dev',
  uri = 'https://discord.alexpedersen.dev/interactions',
  statement = 'I accept the Terms of Use (https://discord.alexpedersen.dev/terms-of-use) and the Privacy Policy (https://discord.alexpedersen.dev/privacy-policy)'
) => {
  const data = await exchangeNonce(address)
  const message = `${domain} wants you to sign in with your Ronin account:\n${address.replace('0x', 'ronin:').toLowerCase()}\n\n${statement}\n\nURI: ${uri}\nVersion: 1\nChain ID: 2020\nNonce: ${data.nonce}\nIssued At: ${data.issued_at}\nExpiration Time: ${data.expiration_time}\nNot Before: ${data.not_before}`
  /*
        Example message:
        app.axieinfinity.com wants you to sign in with your Ronin account: ronin:af9d50d8e6e19e3163583f293bb9b457cd28e8af I accept the Terms of Use (https://axieinfinity.com/terms-of-use) and the Privacy Policy (https://axieinfinity.com/privacy-policy) URI: https://app.axieinfinity.com Version: 1 Chain ID: 2020 Nonce: 13706446796901304963 Issued At: 2023-06-16T14:05:11Z Expiration Time: 2023-06-16T14:05:41Z Not Before: 2023-06-16T14:05:11Z
    */
  return message
}

interface IAuthLoginResponse {
  accessToken: string
  accessTokenExpiresAt: string
  accessTokenExpiresIn: number
  refreshToken: string
  userID: string
  enabled_mfa: boolean
}

export const exchangeToken = async (signature: string, message: string) => {
  const data = await apiRequest<IAuthLoginResponse>(AUTH_LOGIN_URL, JSON.stringify({ signature, message }))
  return data
}

export const refreshToken = async (refreshToken: string) => {
  const data = await apiRequest<IAuthLoginResponse>(AUTH_TOKEN_REFRESH_URL, JSON.stringify({ refreshToken }))
  const newAccessToken = data.accessToken
  const newRefreshToken = data.refreshToken
  return { newAccessToken, newRefreshToken }
}

interface IAuthFetchNonceResponse {
  nonce: string
  issued_at: string
  not_before: string
  expiration_time: string
}

export const exchangeNonce = async (address: string) => {
  return await apiRequest<IAuthFetchNonceResponse>(`${AUTH_NONCE_URL}?address=${address}`, null, {}, 'GET')
}
