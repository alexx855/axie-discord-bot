import { RONIN_WALLET_COMMAND, TRANSFER_AXIE_COMMAND, TRANSFER_ALL_AXIES_COMMAND, LIST_AXIE_COMMAND, UNLIST_AXIE_COMMAND, AXIE_COMMAND, GET_ORDERS_COMMAND, REMOVE_ORDER_COMMAND, ADD_ORDER_COMMAND } from './src/constants'
import { InstallGuildCommands } from './src/utils'

const main = () => {
  const appId = process.env.DISCORD_CLIENT_ID
  const guildId = process.env.DISCORD_GUILD_ID
  if (appId === undefined || guildId === undefined) {
    throw new Error('Discord client ID is undefined')
  }

  // Check if guild commands are installed (if not, install them)
  InstallGuildCommands(appId, guildId, [
    RONIN_WALLET_COMMAND,
    TRANSFER_ALL_AXIES_COMMAND,
    AXIE_COMMAND,
    GET_ORDERS_COMMAND,
    REMOVE_ORDER_COMMAND,
    ADD_ORDER_COMMAND,
    // TRANSFER_AXIE_COMMAND,
    // LIST_AXIE_COMMAND,
    // UNLIST_AXIE_COMMAND,
  ])
    .then((res) => {
      console.log('Installed global commands', res)
    }).catch((error) => {
      console.log(error)
    })
}

main()
