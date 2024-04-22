import {
  WALLET_COMMAND,
  TRANSFER_AXIE_COMMAND,
  TRANSFER_AXIE_ALL_COMMAND,
  CANCEL_AXIE_SALE_COMMAND,
  CREATE_AXIE_SALE_ALL_COMMAND,
  CANCEL_AXIE_SALE_ALL_COMMAND,
  BUY_AXIE_COMMAND,
  CREATE_AXIE_SALE_COMMAND,
  AXIE_INFO_COMMAND,
  PING_COMMAND
} from './constants'
import { DeleteCommands, InstallGlobalCommands, InstallGuildCommands } from './utils'

const main = async () => {
  if (process.env.DISCORD_CLIENT_ID === undefined || process.env.DISCORD_GUILD_ID === undefined) {
    throw new Error('Missing environment variables')
  }

  // await DeleteCommands()
  // InstallGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID, [
  InstallGlobalCommands(process.env.DISCORD_CLIENT_ID, [
    PING_COMMAND,
    WALLET_COMMAND,
    CREATE_AXIE_SALE_COMMAND,
    CREATE_AXIE_SALE_ALL_COMMAND,
    CANCEL_AXIE_SALE_COMMAND,
    CANCEL_AXIE_SALE_ALL_COMMAND,
    TRANSFER_AXIE_COMMAND,
    TRANSFER_AXIE_ALL_COMMAND,
    BUY_AXIE_COMMAND,
    AXIE_INFO_COMMAND
  ])
    .then(() => {
      console.log('Installed guild commands')
    }).catch((error) => {
      console.log(error)
    })
}

void main()
