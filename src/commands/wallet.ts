import { RONIN_CHAIN } from '../constants'
import { createPublicClient, formatEther, http, isHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { InteractionResponseType } from 'discord-interactions'
import { roninAddress } from '../utils'
import { WRAPPED_ETHER } from '@roninbuilders/contracts'
import { getAxieIdsFromAddress } from '../axies'

export const walletCommandHandler = async () => {
  if (process.env.PRIVATE_KEY === undefined || !isHex(process.env.PRIVATE_KEY)) {
    throw new Error('Private key not valid, check .env file, should start with 0x')
  }
  const account = privateKeyToAccount(process.env.PRIVATE_KEY)
  const { address } = account

  const publicClient = createPublicClient({
    chain: RONIN_CHAIN,
    transport: http()
  })

  // get RON balance
  const ronBalance = await publicClient.getBalance({
    address
  })

  // get WETH balance
  const wethBalance = await publicClient.readContract({
    address: WRAPPED_ETHER.address,
    abi: WRAPPED_ETHER.abi,
    functionName: 'balanceOf',
    args: [address]
  })

  // get axies balance
  const axiesIdsList = await getAxieIdsFromAddress(address, publicClient)

  const marketplaceProfileUrl = `https://app.axieinfinity.com/profile/${roninAddress(address)}`

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: 'Marketplace App Profile',
              style: 5,
              url: marketplaceProfileUrl
            }
          ]
        }
      ],
      embeds: [
        {
          title: roninAddress(address),
          description: `**RON:** ${formatEther(ronBalance)}\n**ETH:** ${formatEther(wethBalance)}\n**Axies:** ${axiesIdsList.length} (#${axiesIdsList.join(', ')})`
        }
      ]
    }
  }
}
