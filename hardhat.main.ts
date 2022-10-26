import {
  CONTRACT_AXIE_ADDRESS,
  CONTRACT_AXIE_ABI_JSON_PATH
} from './constants'
import '@nomicfoundation/hardhat-toolbox'
import * as fs from 'fs/promises'
import * as dotenv from 'dotenv'
// import "@nomiclabs/hardhat-ethers";
// import { ethers } from 'ethers';
import { ethers } from 'hardhat'
import {
  execOrders,
  fetchMarketResultsByCriteria,
  getMarketOrders
} from './utils'
dotenv.config()

// async function main(): Promise<void> {
export async function main (): Promise<void> {
  const [deployer] = await ethers.getSigners()
  console.log('deployer', deployer.address)

  const accounts = await ethers.getSigners()
  const account = accounts[0].address
  const signer = accounts[0]
  // get account balance
  const balance = await ethers.provider.getBalance(account)
  // convert balance to ether
  const balanceInEther = ethers.utils.formatEther(balance)
  console.log('balance', balanceInEther)
  // get axie contract, load axie abi
  const axieAbi = JSON.parse(
    await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8')
  )
  const axieContract = await ethers.getContractAt(
    axieAbi,
    CONTRACT_AXIE_ADDRESS,
    signer
  )
  console.log('axieContract', axieContract.address)
  // get axies balance for account
  const axiesBalance = await axieContract.balanceOf(account)
  console.log('axiesBalance', ethers.BigNumber.from(axiesBalance).toNumber())
  // get market contract, load market abi
  // const marketAbi = JSON.parse(await fs.readFile(CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH, 'utf8'))
  // const marketContract = await ethers.getContractAt(marketAbi, CONTRACT_MARKETPLACE_V2_ADDRESS, signer)
  // console.log('marketContract', marketContract.address)

  // todo: move to a pubsub function, subscribe to market orders changes
  // get open market orders array from redis
  const marketOrders = await getMarketOrders()
  const subsriptions = []
  if (marketOrders.length > 0) {
    for (let i = 0; i < marketOrders.length; i++) {
      const marketOrder = marketOrders[i]
      console.log('marketOrder', marketOrder)

      // subscribe to new blocks
      // todo: handle unsubscribe
      subsriptions[marketOrder.id] = ethers.provider.on(
        'block',
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (blockNumber) => {
          // todo: track time, if time is greater than 3 secs, unsubscribe
          // console.log('new block', blockNumber)
          console.log('Ping from marketOrder#', marketOrder.id)
          // get block info
          // const block = await ethers.provider.getBlock(blockNumber)

          // todo: calculate time difference between current block and latest block
          // console.log('time difference', block.timestamp - previousBlockTimestamp)

          // const marketProps: MarketPropsInterface = {
          //     class: ['Plant'],
          //     part: [
          //         'ears-sakura',
          //         'mouth-silence-whisper',
          //         'horn-strawberry-shortcake'
          //     ],
          //     breedCount: 0,
          //     pureness: 5,
          //     triggerPrice: "0.049999",
          // };

          // fetch a list of existing Axies based on the given props
          const orders = await fetchMarketResultsByCriteria(
            marketOrder.marketProps
          )
          console.log('orders', orders)

          if (orders.length > 0) {
            // keep only the first order for now, should be the cheapest
            const order = orders[0]
            console.log('NEW ORDER EXECUTION', order)

            // todo: unsubscribe
            execOrders(order, marketOrder)
          }
        }
      )
    }
  }

  // todo: fetch a list of the recently sold items, save to the database, for big data analysis later
  // https://axie-graphql.web.app/operations/getRecentlyAxiesSold

  // sleep for 10 seconds
  // await new Promise((resolve) => setTimeout(resolve, 10000))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
