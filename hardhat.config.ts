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
import * as fs from 'fs/promises'

import * as dotenv from 'dotenv'
import { fetchApi } from './utils'
dotenv.config()

export interface Asset {
  [key: string]: any
}

task('buy', 'Buy and axie from the marketplace')
  .addParam('axie', 'The axie ID without #')
  .setAction(async (taskArgs: { axie: string }, hre) => {
    const { ethers } = hre
    try {
      // "sell": " npx hardhat sell --axie 11537896 --fromPrice 0.2 --price 0.1 --duration 1"
      // const gasPrice = json_data['gasPrice']
      const axieId = parseInt(taskArgs.axie, 10)
      if (isNaN(axieId) || axieId <= 0) {
        throw new Error('Invalid Axie ID provided')
      }

      const accounts = await ethers.getSigners()
      const account = accounts[0].address
      // const signer = accounts[0]
      // accessToken = AccessToken.GenerateAccessToken(key, address)

      // get axie contract
      const axieContract = await ethers.getContractAt(
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
      const marketplaceContract = await ethers.getContractAt(
        marketAbi,
        CONTRACT_MARKETPLACE_V2_ADDRESS
      )

      // query the marketplace for the axie order, rm this just for testing
      const query = 'query GetAxieDetail($axieId: ID!){ axie(axieId: $axieId){id,order{...on Order{id,maker,kind,assets{...on Asset{erc,address,id,quantity,orderId}}expiredAt,paymentToken,startedAt,basePrice,endedAt,endedPrice,expectedState,nonce,marketFeePercentage,signature,hash,duration,timeLeft,currentPrice,suggestedPrice,currentPriceUsd}}}}'
      const variables = {
        axieId
      }
      const result: any = await fetchApi(query, variables)
      // console.log(result)

      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!result.axie) {
        throw new Error('Axie not found')
      }

      const order = result.axie.order

      // get account balance
      const balance = await ethers.provider.getBalance(account)
      const currentPrice = ethers.BigNumber.from(order.currentPrice)
      // check if have enough balance
      if (currentPrice.gte(balance)) {
        throw new Error('Not enough balance')
      }

      // get weth contract
      const wethContract = await ethers.getContractAt(
        JSON.parse(await fs.readFile(CONTRACT_WETH_ABI_JSON_PATH, 'utf8')),
        CONTRACT_WETH_ADDRESS
      )

      // approve WETH Contract to transfer WETH from the account
      const amountToapproved = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
      const txApproveWETH = await wethContract.approve(account, amountToapproved)
      console.log('txApproveWETH', txApproveWETH.hash)

      const allowance = await wethContract.allowance(account, CONTRACT_MARKETPLACE_V2_ADDRESS)
      // console.log('allowance', allowance)
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!allowance.gte(currentPrice)) {
        throw new Error('Please approve the marketplace contract to transfer WETH')
      }

      // buy the axie
      const settleOrderData = marketplaceContract.interface.encodeFunctionData('settleOrder',
        [
          0,
          order.currentPrice,
          account,
          order.signature,
          [
            order.maker,
            1,
            [[
              1,
              order.assets[0].address,
              order.assets[0].id,
              order.assets[0].quantity
            ]],
            order.expiredAt,
            CONTRACT_WETH_ADDRESS,
            order.startedAt,
            order.basePrice,
            order.endedAt,
            order.endedPrice,
            0,
            order.nonce,
            425
          ]
        ]
      )

      const txBuyAxie = await marketplaceContract.interactWith('ORDER_EXCHANGE', settleOrderData)
      console.log('txBuyAxie hash ', txBuyAxie.hash)
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
