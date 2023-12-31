import { AXIE_PROXY } from '@roninbuilders/contracts'
import { InteractionResponseType } from 'discord-interactions'
import { isHex, createPublicClient, http, createWalletClient, isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { OPEN_EXPLORER_APP_LABEL, RONIN_CHAIN } from '../constants'
import { roninAddress } from '../utils'

export const transferAxieCommandHandler = async (axieId: string, addressTo: `0x${string}`) => {
  if (process.env.PRIVATE_KEY === undefined || !isHex(process.env.PRIVATE_KEY)) {
    throw new Error('Private key not valid, check .env file, should start with 0x')
  }
  if (!isAddress(addressTo)) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: `Error transferring axie #${axieId}`,
          description: 'Invalid address',
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
    const { request } = await publicClient.simulateContract({
      account,
      address: AXIE_PROXY.address,
      abi: AXIE_PROXY.abi,
      functionName: 'transferFrom',
      args: [address, addressTo, Number(axieId)]
    })

    const txHash = await walletClient.writeContract(request)
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
            title: `Transferingh axie #${axieId}`,
            description: `**From:** ${roninAddress(address)} \n **To:** ${roninAddress(addressTo)}`
          }
        ]
      }
    }
  } catch (error) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: `Error transferring axie #${axieId}`,
          description: (error as any).shortMessage ?? 'Unknown error',
          color: 0xff0000 // Red color
        }],
        tts: false
      }
    }
  }
}
