import { InteractionResponseType } from 'discord-interactions'
import { isHex, createPublicClient, http, createWalletClient, isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { OPEN_EXPLORER_APP_LABEL, RONIN_CHAIN } from '../constants'
import { roninAddress } from '../utils'
import { getAxieIdsFromAddress } from '../axies'
import { ERC721_BATCH_TRANSFER, AXIE_PROXY } from '@roninbuilders/contracts'

export const transferAllAxiesCommandHandler = async (addressTo: `0x${string}`) => {
  if (process.env.PRIVATE_KEY === undefined || !isHex(process.env.PRIVATE_KEY)) {
    throw new Error('Private key not valid, check .env file, should start with 0x')
  }
  if (!isAddress(addressTo)) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: 'Error transferring all axies',
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
    // Get all axies from address
    const axiesIdsList = await getAxieIdsFromAddress(address, publicClient)

    // Check if the batch contract is approved to transfer the axies from address
    const isApproved = await publicClient.readContract({
      address: AXIE_PROXY.address,
      abi: AXIE_PROXY.abi,
      functionName: 'isApprovedForAll',
      args: [address, ERC721_BATCH_TRANSFER.address]
    })
    console.log('isApproved:', isApproved)

    // msg.sender has to call setApprovalForAll on _tokenContract to authorize this contract.
    let approvalReceiptTotalCost: bigint = 0n
    let approvalTxHash: `0x${string}` | null = null
    if (!isApproved) {
      const { request: approvalRequest } = await publicClient.simulateContract({
        account,
        address: AXIE_PROXY.address,
        abi: AXIE_PROXY.abi,
        functionName: 'setApprovalForAll',
        args: [ERC721_BATCH_TRANSFER.address, true]
      })

      approvalTxHash = await walletClient.writeContract(approvalRequest)
      const approvalReceipt = await publicClient.waitForTransactionReceipt(
        {
          confirmations: 2,
          hash: approvalTxHash,
          onReplaced: replacement => { console.log(replacement) },
          pollingInterval: 1_000,
          timeout: 30_000
        }
      )
      approvalReceiptTotalCost = approvalReceipt.gasUsed * approvalReceipt.effectiveGasPrice
      console.log(`Approval receipt total cost: ${approvalReceiptTotalCost} wei`)
    }

    const { request } = await publicClient.simulateContract({
      account,
      address: ERC721_BATCH_TRANSFER.address,
      abi: ERC721_BATCH_TRANSFER.abi,
      functionName: 'safeBatchTransfer',
      args: [AXIE_PROXY.address, axiesIdsList, addressTo]
    })

    const txHash = await walletClient.writeContract(request)
    const components = [
      {
        type: 2,
        label: OPEN_EXPLORER_APP_LABEL,
        style: 5,
        url: `https://app.roninchain.com/tx/${txHash as string}`
      }
    ]
    if (approvalTxHash !== null) {
      components.push(
        {
          type: 2,
          label: 'Approval Batch Transfer Tx',
          style: 5,
          url: `https://app.roninchain.com/tx/${approvalTxHash as string}`
        }
      )
    }

    // Send a message into the channel where command was triggered from
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        components: [
          {
            type: 1,
            components
          }
        ],
        embeds: [
          {
            title: `Trasfering ${axiesIdsList.length} axies`,
            description: `**From:** ${roninAddress(address)} \n **To:** ${roninAddress(addressTo)}\n **Axies:** ${axiesIdsList.join(', ')}\n`
          }
        ]
      }
    }
  } catch (error) {
    console.log(JSON.stringify(error))
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: 'Error batch transferring all axies',
          description: (error as any).shortMessage ?? 'Unknown error',
          color: 0xff0000 // Red color
        }],
        tts: false
      }
    }
  }
}
