# Axie Infinity Discord Bot

This bot can buy Axies from the marketplace based on the given criteria, it uses your private key to sign the transaction, so you will need to run it on your own machine or a server that you control, never share your private key with anyone.

## This bot is meant to be self hosted

You can use it as a reference to build your own bot

### Self host setup

Create and fill your custom .env with your discord client id and discord bot token

Fetching credentials is covered in detail in the [getting started guide](https://discord.com/developers/docs/getting-started).

```bash
cp .env.example .env
code .env
```

Install dependencies

```bash
npm install
```

Install discord commands

```bash
npm run install-discord-commands

```

Start the bot with docker compose

```bash
docker compose up
```

You will need to expose teh express server to the internet and configure the discord app to use that url for the interactions <https://discord.com/developers/docs/intro>
You could use <https://doc.traefik.io/traefik/> for example, to create a proxy that expose your self hosted bot to the internet, i have an example of a docker compose file that doest that here: <https://github.com/alexx855/traefik-proxy-home>

### Commands available in discord

An order is a set of filters that will be used to buy axies from the marketplace as soon as they are listed

- */axie $AXIE_ID* - Get axie info by ID
- */add_order* - Create a order that will automatically trigger based on the given price and the marketplace url filters
- */get_orders* - Get open orders
- */remove_order $ORDER_ID* - Remove order by ID
- */account* - Get bot wallet account info

### Development

Install dependencies

```bash
npm install
```

Start the bot in development mode

```bash
NODE_DEV="dev" docker compose up
```

#### Screenshots

![/axie](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Axie.png) | ![/add_order](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_CreateOrder.png)
--- | ---
![/add_order](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Modal.png) | ![Image 4](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Orders.png)
--- | ---
![example](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Tx.png) |

#### Contributing

Feel free to contribute with PRs and issues

#### License

[MIT]
