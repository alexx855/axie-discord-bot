import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'

import * as dotenv from 'dotenv'
dotenv.config()

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(`- ${account.address as string}`)

    // TODO: get balance

    // TODO: get tokens balances
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const privateKeys = [process.env.PRIVATE_KEY as string]
const config: HardhatUserConfig = {
  defaultNetwork: 'ronin',
  networks: {
    hardhat: {
      chainId: 1337
    },
    ronin: {
      chainId: 2020,
      // chainId: 2022,
      // url: 'http://localhost:8545',
      url: 'http://host.docker.internal:8545',
      accounts: privateKeys
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
