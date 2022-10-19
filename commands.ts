/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { getRPSChoices } from './game'
import { capitalize, DiscordRequest } from './utils'

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
      } else {
        console.log(`"${command.name}" command already installed`)
      }
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

// Get the game choices from game.js
function createCommandChoices (): any[] {
  const choices = getRPSChoices()
  const commandChoices: any[] = []

  for (const choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase()
    })
  }

  return commandChoices
}

// Simple test command
export const TEST_COMMAND = {
  name: 'test',
  description: 'Basic guild command',
  type: 1
}

// Command containing options
export const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices()
    }
  ],
  type: 1
}
