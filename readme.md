# Axie Infinity Marketplace Bot

This project provides a Discord bot that interacts with the Axie Infinity marketplace on the Ronin Network. The bot is capable of performing transactions using a private key. **Please exercise caution when deploying this bot, as it can execute transactions on behalf of the private key specified in the .env file.**

## Prerequisites

- Node.js 20.x
- npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/alexx855/axie-discord-bot.git
```

2. Install dependencies:

```bash
npm install
```

3. Copy the .env.example file to .env and fill in the required values: 

Complete your environment variables. Fetching discord credentials is covered in detail in the [getting started guide](https://discord.com/developers/docs/getting-started).


```bash
cp .env.example .env
```

4. Install discord commands

```bash
npm run install-commands

```

5. Deploy the bot to vercel

```bash
vercel --prod
```

6. Configure your discord bot  **INTERACTIONS ENDPOINT URL** to use the deployed bot vercel url + /interactions. For example: **https://your-bot.vercel.app/interactions** in the discord developer portal. (https://discord.com/developers/applications/)

### Commands available

- */axie_info $AXIE_ID* - Get axie info
- */wallet* - Get bot wallet account info (ronin address, balance, etc)
- */axie_buy $AXIE_ID* - Buy the given axie
- */axie_sale $AXIE_ID $PRICE* - Create a sale order for the given axie
- */axie_sale_all $PRICE* - Create a sale order for all axies
- */axie_cancel_sale $AXIE_ID* - Cancel sale order for the given axie
- */axie_cancel_sale_all* - Cancel all sale orders
- */axie_transfer $AXIE_ID $ADDRESS* - Transfer axie to  the given address
- */axie_transfer_all $ADDRESS* - Transfer all axies to the given address

#### Contributing

Feel free to contribute to this project. Any help is appreciated!
