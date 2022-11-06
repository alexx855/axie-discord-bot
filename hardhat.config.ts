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
      // console.log('txUnlistAxie', txUnlistAxie.hash)
      return txUnlistAxie.hash
    } catch (error) {
      console.error(error)
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
