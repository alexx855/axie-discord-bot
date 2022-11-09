import {
  CONTRACT_AXIE_ADDRESS,
  CONTRACT_AXIE_ABI_JSON_PATH,
  CONTRACT_MARKETPLACE_V2_ADDRESS,
  CONTRACT_WETH_ADDRESS,
  CONTRACT_WETH_ABI_JSON_PATH,
  CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH
} from './constants'
import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomiclabs/hardhat-ethers'
import { BigNumber } from 'ethers'
import { createAccessTokenWithSignature, fetchApi, getRandomMessage, ITriggerOrder } from './utils'
import * as fs from 'fs/promises'

import * as dotenv from 'dotenv'
dotenv.config()

export interface Asset {
  [key: string]: any
}

task('buy', 'Buy and axie from the marketplace')
  .addParam('order', 'The trigger order object to trigger')
  .setAction(async (taskArgs: { order: string }, hre) => {
    try {
      const order: ITriggerOrder = JSON.parse(taskArgs.order)

      const axieId = parseInt(order.axieId, 10)
      if (isNaN(axieId)) {
        throw new Error('Invalid Axie ID provided')
      }

      const accounts = await hre.ethers.getSigners()
      const account = accounts[0].address

      // get axie contract
      const axieContract = await hre.ethers.getContractAt(
        JSON.parse(await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8')),
        CONTRACT_AXIE_ADDRESS
      )

      // check if the account has given approval to the marketplace contract to transfer the axie
      const isApproved: boolean = await axieContract.isApprovedForAll(account, CONTRACT_MARKETPLACE_V2_ADDRESS)
      if (!isApproved) {
        throw new Error('Please approve the marketplace contract to transfer the axie')
      }

      // get marketplace contract
      const marketAbi = JSON.parse(await fs.readFile(CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH, 'utf8'))
      const marketplaceContract = await hre.ethers.getContractAt(
        marketAbi,
        CONTRACT_MARKETPLACE_V2_ADDRESS
      )

      // check if have enough balance
      const balance = await hre.ethers.provider.getBalance(account)
      const currentPrice = hre.ethers.BigNumber.from(order.currentPrice)
      if (currentPrice.gte(balance)) {
        throw new Error('Not enough balance')
      }

      // approve WETH Contract to transfer WETH from the account
      const wethContract = await hre.ethers.getContractAt(
        JSON.parse(await fs.readFile(CONTRACT_WETH_ABI_JSON_PATH, 'utf8')),
        CONTRACT_WETH_ADDRESS
      )
      const allowance: BigNumber = await wethContract.allowance(account, CONTRACT_MARKETPLACE_V2_ADDRESS)
      // console.log('WETH Allowance ', allowance.toString())
      if (!allowance.gte(0)) {
        // same amount as the ronin wallet approval, got it from there
        const amountToapproved = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
        const txApproveWETH = await wethContract.approve(account, amountToapproved)
        console.log('txApproveWETH', txApproveWETH.hash)

        throw new Error('Need approve the marketplace contract to transfer WETH, no allowance')
      }

      // create the order data
      const settleOrderData = marketplaceContract.interface.encodeFunctionData('settleOrder',
        [
          0, // expectedState
          order.currentPrice, // settlePrice
          '0x0c4773cc8abd313f83686db0ed6c947a7fef01c6', // referralAddr
          order.signature, // signature
          [
            order.maker,
            1, // market order kind
            [[ // MarketAsset.Asset[]
              1, // MarketAsset.TokenStandard
              order.assets[0].address,
              order.assets[0].id,
              order.assets[0].quantity
            ]],
            order.expiredAt,
            CONTRACT_WETH_ADDRESS, // paymentToken
            order.startedAt,
            order.basePrice,
            order.endedAt,
            order.endedPrice,
            0, // expectedState
            order.nonce,
            425 // Market fee percentage, 4.25%
          ]
        ]
      )

      const txBuyAxie: any = await marketplaceContract.interactWith('ORDER_EXCHANGE', settleOrderData)
      // console.log('txBuyAxie', txBuyAxie)

      // ?? todo: validate that the tx not failed, like this one https://explorer.roninchain.com/tx/0xc99162e0ff6880730dc9a3d1427d702c6c60fdbca4b8201d087a6bc0ad2eee1e
      // ?? todo: validate that we're the owners of the axie now, with a rpc call to the contract

      return txBuyAxie.hash
    } catch (error) {
      console.error(error)
      throw error
    }
  })

task('unlist', 'Unlist an axie on the marketplace')
  .addParam('axie', 'The axie ID without #')
  .setAction(async (taskArgs: { axie: string }, hre) => {
    try {
      const axieId = parseInt(taskArgs.axie, 10)
      if (isNaN(axieId)) {
        throw new Error('Invalid Axie ID provided')
      }
      // query the marketplace for the axie order
      const query = `
          query GetAxieDetail($axieId: ID!) {
            axie(axieId: $axieId) {
              id
              order {
                ... on Order {
                  id
                  maker
                  kind
                  assets {
                    ... on Asset {
                      erc
                      address
                      id
                      quantity
                      orderId
                    }
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
                }
              }
            }
          }
        `
      const variables = {
        axieId
      }

      const result = await fetchApi(query, variables)
      const order: any | null = result?.data?.axie?.order
      if (order === null) {
        throw new Error('Axie is not listed on the marketplace')
      }

      // get marketplace contract
      const marketAbi = JSON.parse(await fs.readFile(CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH, 'utf8'))
      const marketplaceContract: any = await hre.ethers.getContractAt(
        marketAbi,
        CONTRACT_MARKETPLACE_V2_ADDRESS
      )

      // create the cancel order data
      const cancelOrderData = marketplaceContract.interface.encodeFunctionData('cancelOrder',
        [
          [
            order.maker,
            1, // market order kind
            [[ // MarketAsset.Asset[]
              1, // MarketAsset.TokenStandard
              order.assets[0].address,
              order.assets[0].id,
              order.assets[0].quantity
            ]],
            order.expiredAt,
            CONTRACT_WETH_ADDRESS, // paymentToken
            order.startedAt,
            order.basePrice,
            order.endedAt,
            order.endedPrice,
            0, // expectedState
            order.nonce,
            425 // Market fee percentage, 4.25%
          ]
        ]
      )

      const txUnlistAxie = await marketplaceContract.interactWith('ORDER_EXCHANGE', cancelOrderData)
      console.log('txUnlistAxie', txUnlistAxie.hash)
      return txUnlistAxie.hash
    } catch (error) {
      console.error(error)
    }
  })

task('list', 'List an axie on the marketplace')
  .addParam('axie', 'The axie ID without #')
  .addParam('basePrice', 'The start price like the marketplace, example: 0.1')
  .addParam('access-token', 'The marketplace access token')
  .addOptionalParam('endedPrice', 'The end price like the marketplace, example: 0.01')
  .addOptionalParam('duration', 'The duration of the aution in days')
  .setAction(async (taskArgs: {
    axie: string
    basePrice: string
    endedPrice?: string
    duration?: string
    accessToken: string
  }, hre) => {
    try {
      if (!hre.ethers.utils.parseUnits(taskArgs.basePrice, 'ether')._isBigNumber) {
        throw new Error('Invalid basePrice provided')
      }
      const basePrice = hre.ethers.utils.parseUnits(taskArgs.basePrice, 'ether').toString()
      const accessToken = taskArgs.accessToken
      const accounts = await hre.ethers.getSigners()
      const signer = accounts[0]
      const address = signer.address.toLowerCase()

      const axieId = parseInt(taskArgs.axie, 10)
      if (isNaN(axieId)) {
        throw new Error('Invalid Axie ID provided')
      }

      // get current block timestamp
      const currentBlock = await hre.ethers.provider.getBlock('latest')
      const startedAt = currentBlock.timestamp
      let endedAt = 0
      let duration = 86400 // 86400 seconds in a day, one day as default like the marketplace
      if (taskArgs.duration !== undefined) {
        duration = duration * parseInt(taskArgs.duration, 10)
        if (isNaN(duration)) {
          throw new Error('Invalid duration provided')
        }
        endedAt = startedAt + duration
      }

      let endedPrice
      if (taskArgs.endedPrice !== undefined) {
        if (!hre.ethers.utils.parseUnits(taskArgs.endedPrice, 'ether')._isBigNumber) {
          throw new Error('Invalid endedPrice provided')
        }
        endedPrice = hre.ethers.utils.parseUnits(taskArgs.endedPrice, 'ether').toString()
      } else {
        endedPrice = basePrice
      }
      // ~ 6 months default and max listing duration
      const expiredAt = startedAt + 15634800

      const message = {
        types: {
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
          ],
          EIP712Domain: [
            {
              name: 'name',
              type: 'string'
            },
            {
              name: 'version',
              type: 'string'
            },
            {
              name: 'chainId',
              type: 'uint256'
            },
            {
              name: 'verifyingContract',
              type: 'address'
            }
          ]
        },
        domain: {
          name: 'MarketGateway',
          version: '1',
          chainId: '2020',
          verifyingContract: CONTRACT_MARKETPLACE_V2_ADDRESS
        },
        primaryType: 'Order',
        message: {
          maker: address,
          kind: '1',
          assets: [
            {
              erc: '1',
              addr: CONTRACT_AXIE_ADDRESS,
              id: axieId,
              quantity: '0'
            }
          ],
          expiredAt,
          paymentToken: CONTRACT_WETH_ADDRESS,
          startedAt,
          basePrice,
          endedAt,
          endedPrice,
          expectedState: '0',
          nonce: '0',
          marketFeePercentage: '425'
        }
      }
      // sign the trasaction, we need to call eth_signTypedData_v4 EPI721
      const signature = await hre.ethers.provider.send('eth_signTypedData_v4', [address, JSON.stringify(message)])

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
          nonce: 0,
          assets: [
            {
              id: axieId.toString(),
              address: CONTRACT_AXIE_ADDRESS,
              erc: 'Erc721',
              quantity: '0'
            }
          ],
          basePrice,
          endedPrice,
          startedAt,
          endedAt,
          expiredAt
        },
        signature
      }

      const headers = {
        authorization: `Bearer ${accessToken}`
      }

      // send the order to the marketplace
      const result = await fetchApi(query, variables, headers)
      // console.log('result', result)
      if (result.errors !== undefined) {
        throw new Error(result.errors[0].message)
      }

      // create the activity
      const activityQuery = `mutation AddActivity($action: Action!, $data: ActivityDataInput!) {
        createActivity(action: $action, data: $data) {
          result
          __typename
        }
      }`

      const activityVariables = {
        action: 'ListAxie',
        data: {
          axieId: axieId.toString(),
          priceFrom: basePrice,
          priceTo: endedPrice,
          duration: duration.toString(),
          txHash: result.data.createOrder.hash
        }
      }

      const activityResult = await fetchApi(activityQuery, activityVariables, headers)
      console.log('activityResult', activityResult)
    } catch (error) {
      console.error(error)
      throw error
    }
  })

task('generate-access-token', 'Generate marketplace access token', async (taskArgs, hre) => {
  try {
    const accounts = await hre.ethers.getSigners()
    const signer = accounts[0]
    const address = signer.address.toLowerCase()

    const message = await getRandomMessage()
    const signature = await signer.signMessage(message)
    const token = await createAccessTokenWithSignature(address, message, signature)
    return token
  } catch (error) {
    console.error(error)
    throw error
  }
})

task('account', 'Get info of the deployer account', async (taskArgs, hre) => {
  try {
    const accounts = await hre.ethers.getSigners()
    const address = accounts[0].address.toLowerCase()
    console.log('Address', address)

    // get RON balance
    const balance = await hre.ethers.provider.getBalance(address)
    const balanceInEther = hre.ethers.utils.formatEther(balance)
    console.log('RON:', balanceInEther)

    // get WETH balance
    const WETH_ABI = JSON.parse(await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8'))
    const wethContract = new hre.ethers.Contract(CONTRACT_WETH_ADDRESS, WETH_ABI, hre.ethers.provider)
    const wethBalance = await wethContract.balanceOf(address)
    const wethBalanceInEther = hre.ethers.utils.formatEther(wethBalance)
    console.log('WETH:', wethBalanceInEther)

    // get axie contract
    const AXIE_ABI = JSON.parse(await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8'))
    const axieContract = await new hre.ethers.Contract(CONTRACT_AXIE_ADDRESS, AXIE_ABI, hre.ethers.provider)

    // get axies balance for the address
    const axiesBalance = await axieContract.balanceOf(address)
    console.log('Axies:', hre.ethers.BigNumber.from(axiesBalance).toNumber())
  } catch (error) {
    console.error(error)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  defaultNetwork: 'ronin',
  networks: {
    ronin: {
      chainId: 2020,
      url: process.env.RONIN_NETWORK_URL ?? 'https://api.roninchain.com/rpc',
      accounts: [process.env.PRIVATE_KEY as string]
    }
  }
}

export default config
