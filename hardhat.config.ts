
import {
  CONTRACT_AXIE_ADDRESS,
  CONTRACT_AXIE_ABI_JSON_PATH,
  CONTRACT_MARKETPLACE_V2_ADDRESS,
  CONTRACT_WETH_ADDRESS,
  CONTRACT_WETH_ABI_JSON_PATH,
  CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH,
  DEFAULT_GAS_LIMIT
} from './constants'
import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomiclabs/hardhat-ethers'
import { BigNumber } from 'ethers'
import { ICriteria, IMarketBuyOrder } from './src/interfaces'
import { fetchApi, getRandomMessage, createAccessTokenWithSignature } from './src/utils'
import * as fs from 'fs/promises'
import * as dotenv from 'dotenv'
import { getAxieData, getAxieEstimatedPrice } from './src/axies'
import { fetchMarketByCriteria } from './src/market'
dotenv.config()

task('buy', 'Buy and axie from the marketplace')
  // .addParam('order', 'The trigger order object to trigger')
  .setAction(async (taskArgs: { order: string }, hre): Promise<boolean | string> => {
    // track time
    const startTime = Date.now()
    try {
      const order: IMarketBuyOrder = JSON.parse(taskArgs.order)

      const axieId = parseInt(order.axieId, 10)
      if (isNaN(axieId)) {
        console.log('Invalid Axie ID provided')
        return false
      }

      const accounts = await hre.ethers.getSigners()
      const signer = accounts[0]
      const address = signer.address.toLowerCase()

      // get axie contract
      const axieABI = JSON.parse(await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8'))
      const axieContract = await new hre.ethers.Contract(
        CONTRACT_AXIE_ADDRESS,
        axieABI,
        signer
      )

      // check if the account has given approval to the marketplace contract to transfer the axie
      const isApproved: boolean = await axieContract.isApprovedForAll(address, CONTRACT_MARKETPLACE_V2_ADDRESS)
      if (!isApproved) {
        console.log('Please approve the marketplace contract to transfer the axie')
        return false
      }

      // get marketplace contract
      const marketABI = JSON.parse(await fs.readFile(CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH, 'utf8'))
      const marketplaceContract = await new hre.ethers.Contract(
        CONTRACT_MARKETPLACE_V2_ADDRESS,
        marketABI,
        signer
      )

      // check if have enough balance
      const balance = await hre.ethers.provider.getBalance(address)
      const currentPrice = hre.ethers.BigNumber.from(order.currentPrice)
      if (currentPrice.gte(balance)) {
        console.log('Not enough balance')
        return false
      }

      // approve WETH Contract to transfer WETH from the account
      const wethABI = JSON.parse(await fs.readFile(CONTRACT_WETH_ABI_JSON_PATH, 'utf8'))
      const wethContract = await new hre.ethers.Contract(
        CONTRACT_WETH_ADDRESS,
        wethABI,
        signer
      )
      const allowance: BigNumber = await wethContract.allowance(address, CONTRACT_MARKETPLACE_V2_ADDRESS)
      // console.log('WETH Allowance ', allowance.toString())
      if (!allowance.gte(0)) {
        // same amount as the ronin wallet approval, got it from there
        const amountToapproved = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
        const txApproveWETH = await wethContract.approve(address, amountToapproved, { gasLimit: DEFAULT_GAS_LIMIT })
        console.log('txApproveWETH', txApproveWETH.hash)

        console.log('Need approve the marketplace contract to transfer WETH, no allowance')
        return false
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

      // const gasPrice = (await hre.ethers.provider.getGasPrice()).toNumber()
      const txBuyAxie = await marketplaceContract.interactWith('ORDER_EXCHANGE', settleOrderData, { gasLimit: DEFAULT_GAS_LIMIT })
      const endTime = Date.now()
      console.log('Time to buy', (endTime - startTime), 'ms')
      console.log('txBuyAxie', txBuyAxie.hash)
      return txBuyAxie.hash as string
    } catch (error) {
      console.error(error)
      return false
    }
  })

task('unlist', 'Unlist an axie on the marketplace')
  .addParam('axie', 'The axie ID without #')
  .setAction(async (taskArgs: { axie: string }, hre): Promise<boolean | string> => {
    try {
      const axieId = parseInt(taskArgs.axie, 10)
      if (isNaN(axieId)) {
        console.log('Invalid Axie ID provided')
        return false
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

      interface IAxieOrderResult {
        data?: {
          axie: {
            id: string
            order: {
              id: string
              maker: string
              kind: number
              assets: Array<{
                erc: number
                address: string
                id: string
                quantity: string
                orderId: string
              }>
              expiredAt: string
              paymentToken: string
              startedAt: string
              basePrice: string
              endedAt: string
              endedPrice: string
              expectedState: number
              nonce: string
              marketFeePercentage: number
              signature: string
              hash: string
              duration: number
              timeLeft: number
              currentPrice: string
              suggestedPrice: string
              currentPriceUsd: string
            } | null
          }
          errors?: Array<{
            message: string
          }>
        }
      }

      const result = await fetchApi<IAxieOrderResult>(query, variables)
      // console.log('result', result)
      if (result === null || result.data === undefined || result.data.axie.order == null) {
        console.log('Axie is not listed on the marketplace')
        return false
      }

      const order = result.data.axie.order
      const accounts = await hre.ethers.getSigners()
      const signer = accounts[0]

      // get marketplace contract
      const marketAbi = JSON.parse(await fs.readFile(CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH, 'utf8'))
      const marketplaceContract = await new hre.ethers.Contract(
        CONTRACT_MARKETPLACE_V2_ADDRESS,
        marketAbi,
        signer
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

      const txUnlistAxie = await marketplaceContract.interactWith('ORDER_EXCHANGE', cancelOrderData, { gasLimit: DEFAULT_GAS_LIMIT })
      console.log('Axie unlisted', txUnlistAxie.hash)
      return txUnlistAxie.hash as string
    } catch (error) {
      console.error(error)
      return false
    }
  })

task('list', 'List an axie on the marketplace')
  .addParam('axie', 'The axie ID without #')
  .addParam('basePrice', 'The start price like the marketplace, example: 0.1')
  .addParam('accessToken', 'The marketplace access token')
  .addOptionalParam('endedPrice', 'The end price like the marketplace, example: 0.01')
  .addOptionalParam('duration', 'The duration of the aution in days')
  .setAction(async (taskArgs: {
    axie: string
    basePrice: string
    accessToken: string
    endedPrice?: string
    duration?: string
    gasLimit?: number
  }, hre): Promise<boolean> => {
    try {
      if (!hre.ethers.utils.parseUnits(taskArgs.basePrice, 'ether')._isBigNumber) {
        console.log('Invalid basePrice provided')
        return false
      }
      const basePrice = hre.ethers.utils.parseUnits(taskArgs.basePrice, 'ether').toString()
      const accessToken = taskArgs.accessToken
      const accounts = await hre.ethers.getSigners()
      const signer = accounts[0]
      const address = signer.address.toLowerCase()

      const axieId = parseInt(taskArgs.axie, 10)
      if (isNaN(axieId)) {
        console.log('Invalid Axie ID provided')
        return false
      }

      // get current block timestamp
      const currentBlock = await hre.ethers.provider.getBlock('latest')
      const startedAt = currentBlock.timestamp
      let endedAt = 0
      let duration = 86400 // 86400 seconds in a day, one day as default like the marketplace
      if (taskArgs.duration !== undefined) {
        duration = duration * parseInt(taskArgs.duration, 10)
        if (isNaN(duration)) {
          console.log('Invalid duration provided')
          return false
        }
        endedAt = startedAt + duration
      }

      let endedPrice
      if (taskArgs.endedPrice !== undefined) {
        if (!hre.ethers.utils.parseUnits(taskArgs.endedPrice, 'ether')._isBigNumber) {
          console.log('Invalid endedPrice provided')
          return false
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
      // send the create order mutation
      const result = await fetchApi<ICreateOrderResult>(query, variables, headers)
      // console.log('result', result)
      if (result === null) {
        console.log('Error creating order')
        return false
      }

      if (result.errors !== undefined) {
        console.log('Error creating order', result.errors)
        return false
      }

      // create the activity
      const activityQuery = `mutation AddActivity($action: Action!, $data: ActivityDataInput!) {
        createActivity(action: $action, data: $data) {
          result
          __typename
        }
      }`

      const activityVariables: Object = {
        action: 'ListAxie',
        data: {
          axieId: axieId.toString(),
          priceFrom: basePrice,
          priceTo: endedPrice,
          duration: duration.toString(),
          txHash: result.data?.createOrder.hash
        }
      }

      interface IActivityResult {
        data?: {
          createActivity: {
            result: boolean
          }
        }
        errors?: Array<{
          message: string
        }>
      }

      const activityResult = await fetchApi<IActivityResult>(activityQuery, activityVariables, headers)
      // console.log('activityResult', activityResult)

      if (activityResult === null || activityResult.data === undefined) {
        console.log('Error creating activity')
        return false
      }

      if (activityResult.errors !== undefined) {
        console.log('Error creating activity', activityResult.errors)
        return false
      }

      console.log('Order created result:', activityResult.data.createActivity.result)
      return activityResult.data.createActivity.result
    } catch (error) {
      console.error(error)
      return false
    }
  })

task('generate-access-token', 'Generate marketplace access token', async (taskArgs, hre): Promise<string | false> => {
  try {
    const accounts = await hre.ethers.getSigners()
    const signer = accounts[0]
    const address = signer.address.toLowerCase()

    const message = await getRandomMessage()
    if (message === false) {
      console.log('Error getting random message')
      return false
    }

    const signature = await signer.signMessage(message)
    const token = await createAccessTokenWithSignature(address, message, signature)
    if (token === false) {
      console.log('Error creating access token')
      return false
    }
    console.log('Access token:', token)
    return token
  } catch (error) {
    console.error(error)
    return false
  }
})

task('listall', 'List all axies on the marketplace', async (taskArgs, hre) => {
  try {
    const accounts = await hre.ethers.getSigners()
    const signer = accounts[0]
    const address = signer.address.toLowerCase()
    const accessToken = await hre.run('generate-access-token')
    // get axie contract
    const axieABI = JSON.parse(await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8'))
    const axieContract = await new hre.ethers.Contract(CONTRACT_AXIE_ADDRESS, axieABI, signer)
    // get axies balance for the address
    const axiesBalance = await axieContract.balanceOf(address)
    console.log('Axies:', axiesBalance.toNumber())

    // get axies
    for (let i = 0; i < axiesBalance.toNumber(); i++) {
      const axie: string = (await axieContract.tokenOfOwnerByIndex(address, i)).toString()
      console.log('Listing Axie id:', axie)

      // get axie data from thegraph
      const axieData = await getAxieData(axie)
      if (axieData === false) {
        console.log('Error getting axie data')
        continue
      }

      // check if axie is already listed
      if (axieData.order !== null) {
        console.log('Axie already listed')
        continue
      }

      // get similar axies from market axie
      const criteria: ICriteria = {
        classes: [axieData.class],
        parts: axieData.parts.map((part) => part.id)
        // todo: fix breeding count results
        // breedCount: [axieData.breedCount]
      }
      const similarAxies = await fetchMarketByCriteria(
        criteria
      )

      if (similarAxies === false) {
        console.log('Error getting similar axies')
        continue
      }

      // rarity based on the Axie's R1 genes
      const totalAxies = similarAxies.total
      const rarity = totalAxies === 1 ? 'unique' : totalAxies < 100 ? 'epic' : totalAxies < 1000 ? 'rare' : 'common'

      // // continue if axie is unique
      // if (rarity === 'unique') {
      //   console.log('Axie is unique, skipping')
      //   continue
      // }

      // // get axie breeds, continue if is rare && breed 0
      // if (rarity === 'rare' && axieData.breedCount === 0) {
      //   console.log('Rare axie with breed 0, skipping')
      //   continue
      // }

      const minPrice = '0.008' // in ETH
      const estPrice = await getAxieEstimatedPrice(axie, minPrice)
      if (estPrice === false) {
        console.log('Error getting axie estimated price')
        continue
      }
      const estimatedBasePrice = hre.ethers.BigNumber.from(estPrice)
      const basePrice = hre.ethers.utils.formatEther(estimatedBasePrice)
      console.log('Base price:', basePrice)

      // base price reduced by 30%
      const endedPrice = hre.ethers.utils.formatEther(estimatedBasePrice.mul(70).div(100))
      console.log('Ended price:', endedPrice)

      const duration = '6' // duration in days
      const result = await hre.run('list', { axie, basePrice, accessToken, endedPrice, duration })
      console.log('Listing result:', result)
    }
  } catch (error) {
    console.error(error)
    return false
  }
})

task('account', 'Get info of the deployer account', async (taskArgs, hre) => {
  try {
    const accounts = await hre.ethers.getSigners()
    const signer = accounts[0]
    const address = signer.address.toLowerCase()
    console.log('Address:', address)

    // get RON balance
    const balance = await hre.ethers.provider.getBalance(address)
    const balanceInEther = hre.ethers.utils.formatEther(balance)
    console.log('RON:', balanceInEther)

    // get WETH balance
    const wethABI = JSON.parse(await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8'))
    const wethContract = new hre.ethers.Contract(CONTRACT_WETH_ADDRESS, wethABI, signer)
    const wethBalance = await wethContract.balanceOf(address)
    const wethBalanceInEther = hre.ethers.utils.formatEther(wethBalance)
    console.log('WETH:', wethBalanceInEther)

    // get axie contract
    const axieABI = JSON.parse(await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8'))
    const axieContract = await new hre.ethers.Contract(CONTRACT_AXIE_ADDRESS, axieABI, signer)

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
