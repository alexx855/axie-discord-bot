import { InteractionResponseType } from 'discord-interactions'
import { APP_AXIE_ORDER_EXCHANGE, MARKETPLACE_GATEWAY_V2, MARKET_GATEWAY, WRAPPED_ETHER } from '@roninbuilders/contracts'
import { isHex, createPublicClient, http, createWalletClient, formatEther, encodeFunctionData, parseAbiParameters, encodeAbiParameters } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { OPEN_EXPLORER_APP_LABEL, RONIN_CHAIN } from '../constants'
import { getAxieMarketplaceOrder } from '../marketplace/axie-order'
import { checkAndApproveMarketplace } from './marketplace'

export const buyAxieCommandHandler = async (axieId: string) => {
  if (!isHex(process.env.PRIVATE_KEY)) {
    throw new Error('Private key not valid, check .env file, should start with 0x')
  }

  if (process.env.SKIMAVIS_DAPP_KEY == null) {
    throw new Error('Skimavis Dapp key not valid, check .env file')
  }

  const order = await getAxieMarketplaceOrder(axieId)

  if (!order) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: `Error getting axie #${axieId}`,
          description: 'No order found in the marketplace',
          color: 0xff0000 // Red color
        }],
        tts: false
      }
    }
  }

  const account = privateKeyToAccount(process.env.PRIVATE_KEY)
  const { address } = account

  const walletClient = createWalletClient({
    account,
    chain: RONIN_CHAIN,
    transport: http()
  })

  const publicClient = createPublicClient({
    chain: RONIN_CHAIN,
    transport: http()
  })

  try {
    // ?? move approve to a custom command
    await checkAndApproveMarketplace(publicClient, walletClient)

    // Create the order
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

    const referralAddr = '0xa7d8ca624656922c633732fa2f327f504678d132' // referralAddr => alexx855.ron please keep it to support me and keep the bot running and updated
    const expectedState = BigInt(0)
    const settlePrice = BigInt(order.currentPrice)

    const settledOrderExchangeData = encodeFunctionData({
      abi: APP_AXIE_ORDER_EXCHANGE.abi,
      functionName: 'settleOrder',
      args: [orderData, order.signature as `0x${string}`, settlePrice, referralAddr, expectedState]
    })

    const { request } = await publicClient.simulateContract({
      account,
      address: MARKETPLACE_GATEWAY_V2.address,
      abi: MARKET_GATEWAY.abi,
      functionName: 'interactWith',
      args: ['ORDER_EXCHANGE', settledOrderExchangeData]
    })

    // Wait for the transaction to be mined
    const txHash = await walletClient.writeContract(request)
    // const txHash = await walletClient.writeContract(request)
    const exploreTxLink = `https://app.roninchain.com/tx/${txHash as string}`

    // Send a message into the channel where command was triggered from
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                label: OPEN_EXPLORER_APP_LABEL,
                style: 5,
                url: exploreTxLink
              }
            ]
          }
        ],
        embeds: [
          {
            title: `Buying axie #${axieId}`,
            description: `**Price:** ${formatEther(BigInt(order.currentPrice))} WETH`
          }
        ]
      }
    }
  } catch (error) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: `Error buying axie #${axieId}`,
          description: (error as any).shortMessage ?? 'Unknown error',
          color: 0xff0000 // Red color
        }],
        tts: false
      }
    }
  }
}
