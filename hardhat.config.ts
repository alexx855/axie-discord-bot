import { CONTRACT_MARKETPLACE_V2_ADDRESS, CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH, CONTRACT_AXIE_ADDRESS, CONTRACT_AXIE_ABI_JSON_PATH } from './constants'
import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv'
dotenv.config()

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('info', 'Get info of the deployer account', async (taskArgs, hre) => {
  try {
    const accounts = await hre.ethers.getSigners()
    const account = accounts[0].address
    // get block number
    const blockNumber = await hre.ethers.provider.getBlockNumber()
    console.log('blockNumber', blockNumber)
    // get account balance
    const balance = await hre.ethers.provider.getBalance(account)
    // convert balance to ether
    const balanceInEther = hre.ethers.utils.formatEther(balance)
    console.log('balance', balanceInEther)
    // get axie contract
    const axieAbi = JSON.parse(await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8'))
    const axieContract = await hre.ethers.getContractAt(axieAbi, CONTRACT_AXIE_ADDRESS)
    console.log('axieContract', axieContract.address)
    // get axies balance for account
    const axiesBalance = await axieContract.balanceOf(account)
    console.log('axiesBalance', hre.ethers.BigNumber.from(axiesBalance).toNumber())
  } catch (error) {
    console.error(error)
  }
})

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('test', 'testing market trasaction', async (taskArgs, hre) => {
  try {
    const accounts = await hre.ethers.getSigners()
    const owner = accounts[0].address

    // get axie contract
    const axieContractInterface = await fs.readFile(CONTRACT_AXIE_ABI_JSON_PATH, 'utf8')
    const axieContract = new hre.ethers.Contract(CONTRACT_AXIE_ADDRESS, axieContractInterface, hre.ethers.provider)

    // get axies balance for owner
    const axiesBalance = await axieContract.balanceOf(owner)

    // check if the owner has given approval to the marketplace contract to transfer the axie
    const isApproved = await axieContract.isApprovedForAll(owner, CONTRACT_MARKETPLACE_V2_ADDRESS)
    console.log('isApproved', isApproved)

    if (!isApproved) {
      return console.log('Please approve the marketplace contract to transfer the axie');
    }

    // const bidPrice = ethers.utils.parseEther('1')
    // const askPrice = ethers.utils.parseEther('1')

    // console.log(await provider.getBlockNumber());
    // provider.on("block", (blockNumber) => console.log("new block number " + blockNumber));

    // get marketplace contract
    const marketplaceContractInterface = await fs.readFile(CONTRACT_MARKETPLACE_V2_ABI_JSON_PATH, 'utf8')
    const marketplaceContract = new hre.ethers.Contract(CONTRACT_MARKETPLACE_V2_ADDRESS, marketplaceContractInterface, hre.ethers.provider)

    // Create Axie Auction
    // data to sign
    const axieId = "11481869"
    const data = {
      "types": {
        "Asset": [
          {
            "name": "erc",
            "type": "uint8"
          },
          {
            "name": "addr",
            "type": "address"
          },
          {
            "name": "id",
            "type": "uint256"
          },
          {
            "name": "quantity",
            "type": "uint256"
          }
        ],
        "Order": [
          {
            "name": "maker",
            "type": "address"
          },
          {
            "name": "kind",
            "type": "uint8"
          },
          {
            "name": "assets",
            "type": "Asset[]"
          },
          {
            "name": "expiredAt",
            "type": "uint256"
          },
          {
            "name": "paymentToken",
            "type": "address"
          },
          {
            "name": "startedAt",
            "type": "uint256"
          },
          {
            "name": "basePrice",
            "type": "uint256"
          },
          {
            "name": "endedAt",
            "type": "uint256"
          },
          {
            "name": "endedPrice",
            "type": "uint256"
          },
          {
            "name": "expectedState",
            "type": "uint256"
          },
          {
            "name": "nonce",
            "type": "uint256"
          },
          {
            "name": "marketFeePercentage",
            "type": "uint256"
          }
        ],
        "EIP712Domain": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "version",
            "type": "string"
          },
          {
            "name": "chainId",
            "type": "uint256"
          },
          {
            "name": "verifyingContract",
            "type": "address"
          }
        ]
      },
      "domain": {
        "name": "MarketGateway",
        "version": "1",
        "chainId": "2020",
        "verifyingContract": "0xfff9ce5f71ca6178d3beecedb61e7eff1602950e"
      },
      "primaryType": "Order",
      "message": {
        "maker": "0x00c294859fcf61826d858f349697764864339ff7",
        "kind": "1",
        "assets": [
          {
            "erc": "1",
            "addr": "0x32950db2a7164ae833121501c797d79e7b79d74c",
            "id": "11481869",
            "quantity": "0"
          }
        ],
        "expiredAt": "1682427123",
        "paymentToken": "0xc99a6a985ed2cac1ef41640596c5a5f9f4e19ef5",
        "startedAt": "1666702323",
        "basePrice": "500000000000000000",
        "endedAt": "0",
        "endedPrice": "0",
        "expectedState": "0",
        "nonce": "0",
        "marketFeePercentage": "425"
      }
    }
    // create the order on the marketplace by signing a tx, using the InteractWith action in the marketplaceContract
    // marketplaceContract.interactWith('ORDER_EXCHANGE', data)

  } catch (error) {
    console.error(error)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  defaultNetwork: 'ronin',
  networks: {
    // hardhat: {
    //   chainId: 1337
    // },
    ronin: {
      chainId: 2020,
      url: process.env.RONIN_NETWORK_URL || 'https://api.roninchain.com/rpc',
      accounts: [process.env.PRIVATE_KEY || ''],
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
  },
}

export default config
