# Axie Infinity Discord Bot

This bot can buy Axies from the marketplace based on the given criteria, it uses your private key to sign the transaction, so you will need to run it on your own machine or a server that you control, never share your private key with anyone.

## This bot is meant to be self hosted

You can use it as a reference to build your own bot

|/axie|/add order|/get and remove orders|
|-|-|-|
|[![name](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Axie.png)](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Axie.png)|[![name](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Modal.png)](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Modal.png)|[![name](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Orders.png)](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Orders.png) |

### Setup

Create and fill your custom .env with your discord client id and discord bot token

Fetching credentials is covered in detail in the [getting started guide](https://discord.com/developers/docs/getting-started).

```bash
cp .env.example .env
code .env
```

To start the bot, you will need to expose the port 3000 to the internet and configure the discord bot to use that url for the interactions <https://discord.com/developers/docs/intro>
You can use traefik as a proxy to expose your local machine to the internet, i have an example of a docker compose file that doest that here: <https://github.com/alexx855/traefik-proxy-home>

```bash
docker compose up
```

### Commands available in discord

An order is a set of filters that will be used to buy axies from the marketplace as soon as they are listed

- */axie $AXIE_ID* - Get axie info by ID
- */add_order* - Create a order that will automatically trigger based on the given price and the marketplace url filters
- */get_orders* - Get open orders
- */remove_order $ORDER_ID* - Remove order by ID
