# MitNightShopBot: Your personal 24/7 Discord Marketplace Bot for Axie Infinity

Welcome to MitNightShop, your dedicated Discord bot for the Axie Infinity marketplace on the Ronin Network. Operating 24/7, this bot allows you to create and execute orders automatically, ensuring you never miss an opportunity.

## Key Features:
- **Automated Order Execution**: Set up your buy, sell, or trade orders and MitNightShopBot will execute them automatically, any time of day.
- **User-Friendly Interface**: Simple and direct commands coupled with timely updates keep you well-informed and in control.

**Please exercise caution when deploying this bot, as it can execute transactions on behalf of the private key (account) that must be specified in the `.env` file or as an environment variable.**

## Prerequisites

- Node.js 20.x
- npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/alexx855/mit-night-shop-bot.git
```

2. Install dependencies:

```bash
npm install
```

3. Copy the .env.example file to .env and fill in the required values: 

Fetching discord credentials is covered in detail in the [getting started guide](https://discord.com/developers/docs/getting-started).


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

6. Add environment variables to vercel (you can also use the vercel dashboard)

```bash
vercel env add
```

7. Configure your discord bot  **INTERACTIONS ENDPOINT URL** to use the deployed bot vercel url + /interactions. For example: **https://your-bot.vercel.app/interactions** in the discord developer portal. (https://discord.com/developers/applications/)

### Commands available
- */ping* - Check if the bot is online
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
