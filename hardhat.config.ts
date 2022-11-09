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
import { fetchApi, ITriggerOrder } from './utils'
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
      console.log('order', order)
      const axieId = parseInt(order.axieId, 10)
      if (isNaN(axieId) || axieId <= 0) {
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

      const txBuyAxie = await marketplaceContract.interactWith('ORDER_EXCHANGE', settleOrderData)
      // console.log('txBuyAxie', txBuyAxie)
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
      if (isNaN(axieId) || axieId <= 0) {
        throw new Error('Invalid Axie ID provided')
      }
      // const accounts = await hre.ethers.getSigners()
      // const account = accounts[0].address

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
      const order: any | undefined = result?.data?.axie?.order
      if (order === undefined) {
        throw new Error('Axie is not listed on the marketplace')
      }

      console.log('order', order)

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
  .setAction(async (taskArgs: { axie: string }, hre) => {
    try {
      const accounts = await hre.ethers.getSigners()
      // first account is the default account
      const address = accounts[0].address.toLowerCase()

      // todo: validate id with the api or rpc
      const axieId = parseInt(taskArgs.axie, 10)
      if (isNaN(axieId) || axieId <= 0) {
        throw new Error('Invalid Axie ID provided')
      }

      // get current block timestamp
      const currentBlock = await hre.ethers.provider.getBlock('latest')
      const startedAt = currentBlock.timestamp
      const expiredAt = startedAt + 15724800 // ~ 6 months in seconds, ronin wallet default duration
      const basePrice = '500000000000000000' // 0.5 ETH

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
          basePrice: '500000000000000000',
          endedAt: '0',
          endedPrice: '0',
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
          endedPrice: '0',
          startedAt,
          endedAt: 0,
          expiredAt
        },
        signature
      }

      // todo: generate token or move to env
      const headers = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFlZDUyZjBlLTIzMmUtNjJiMy04NjMzLTQ5YzUyYTNmYTg5ZiIsInNpZCI6ODg2MTE4MDIsInJvbGVzIjpbInVzZXIiXSwic2NwIjpbImFsbCJdLCJhY3RpdmF0ZWQiOnRydWUsImFjdCI6dHJ1ZSwicm9uaW5BZGRyZXNzIjoiMHgwMGMyOTQ4NTlmY2Y2MTgyNmQ4NThmMzQ5Njk3NzY0ODY0MzM5ZmY3IiwiZXhwIjoxNjY5MDQ2NDYwLCJpYXQiOjE2Njc4MzY4NjAsImlzcyI6IkF4aWVJbmZpbml0eSIsInN1YiI6IjFlZDUyZjBlLTIzMmUtNjJiMy04NjMzLTQ5YzUyYTNmYTg5ZiJ9.JJTY5W2yFWi_bxp45i-itLTsHVXCHw5eCgaM5oTu3tA'
      }

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
          priceTo: basePrice,
          duration: '86400', // todo: calculate duration
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

task('account', 'Get info of the deployer account', async (taskArgs, hre) => {
  const { ethers } = hre
  try {
    const accounts = await ethers.getSigners()
    const account = accounts[0].address
    // get account balance
    const balance = await ethers.provider.getBalance(account)
    // convert balance to ether
    const balanceInEther = ethers.utils.formatEther(balance)
    console.log('balance', balanceInEther)

    // get axie contract
    const axieContract = await ethers.getContractAt(
      JSON.parse(await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8')),
      CONTRACT_AXIE_ADDRESS
    )
    // get axies balance for the account
    const axiesBalance = await axieContract.balanceOf(account)
    console.log('axies: ', ethers.BigNumber.from(axiesBalance).toNumber())
  } catch (error) {
    console.error(error)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  defaultNetwork: 'ronin',
  networks: {
    hardhat: {
      chainId: 1337
    },
    ronin: {
      chainId: 2020,
      url: process.env.RONIN_NETWORK_URL ?? 'https://api.roninchain.com/rpc',
      accounts: [process.env.PRIVATE_KEY ?? '']
    }
  },
  solidity: {
    compilers: [
      {
        version: '0.8.0'
      }
    ]
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  mocha: {
    timeout: 600000
  }
}

export default config
