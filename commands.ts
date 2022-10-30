/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { DiscordRequest } from './utils'

export function HasGuildCommands (
  appId: string | undefined,
  guildId: string | undefined,
  commands: any[]
): void {
  if (guildId === '' || appId === '') return

  commands.forEach((c: any) => {
    HasGuildCommand(appId, guildId, c).catch((err) => {
      console.error('Error checking command:', err)
    })
  })
}

// Checks for a command
async function HasGuildCommand (
  appId: any,
  guildId: any,
  command: { [x: string]: any }
): Promise<void> {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`

  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' })
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (data) {
      const installedNames = data.map((c: any) => c.name)
      // This is just matching on the name, so it's not good for updates
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!installedNames.includes(command.name)) {
        console.log(`Installing "${command.name}"`)
        InstallGuildCommand(appId, guildId, command).catch((err) => {
          console.error('Error installing command:', err)
        })
      } 
      // else {
      //   console.log(`"${command.name}" command already installed`)
      //   // Update command
      //   const commandId = data.find((c: any) => c.name === command.name).id
      //   UpdateGuildCommand(appId, guildId, commandId, command).catch((err) => {
      //     console.error('Error updating command:', err)
      //   })
      // }
    }
  } catch (err) {
    console.error(err)
  }
}

// Updates a command
export async function UpdateGuildCommand (
  appId: any,
  guildId: any,
  commandId: any,
  command: { [x: string]: any }
): Promise<void> {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands/${commandId}`

  try {
    const res = await DiscordRequest(endpoint, { method: 'PATCH', body: command })
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (data) {
      console.log(`"${command.name}" command updated`)
    }
  } catch (err) {
    console.error(err)
  }
}
// Installs a command
export async function InstallGuildCommand (
  appId: any,
  guildId: any,
  command: any
): Promise<void> {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`
  // install command
  try {
    await DiscordRequest(endpoint, { method: 'POST', body: command })
  } catch (err) {
    console.error(err)
  }
}

// // Run the guild command
// export async function runGuildCommand (
//   appId: any,
//   guildId: any,
//   command: any
// ): Promise<void> {
//   // API endpoint to get and post guild commands
//   const endpoint = `applications/${appId}/guilds/${guildId}/commands`
//   // install command
//   try {
//     await DiscordRequest(endpoint, { method: 'POST', body: command })
//   } catch (err) {
//     console.error(err)
//   }
// }

// Command that returns custom axie data, like estimated price
export const AXIE_COMMAND = {
  name: 'axie',
  description: 'Get custom axie data by ID',
  options: [
    {
      name: 'axie_id',
      description: 'Axie ID',
      type: 3,
      required: true
    }
  ],
  type: 1
}

// Commands for the orders management
export const GET_ORDERS_COMMAND = {
  name: 'get_orders',
  description: 'Get open bot orders',
  type: 1
}

export const REMOVE_ORDER_COMMAND = {
  name: 'remove_order',
  description: 'Remove open bot order',
  options: [
    {
      name: 'order_id',
      description: 'Order ID',
      type: 3,
      required: true
    }
  ],
  type: 1
}

export const ADD_ORDER_COMMAND = {
  name: 'add_order',
  description: 'Add bot order',
  type: 1
}
