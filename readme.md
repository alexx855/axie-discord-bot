# Axie Marketplace Sniper Discord Bot

A Discord bot to mange Axies. It uses a private key to sign transactions, so it can be used to buy, sell, transfer axies, etc.

## Tutorial

Install dependencies

```bash
npm install
```

Install discord commands

```bash
npm run install-commands

```

Complete your environment variables

```bash
cp .env.example .env
```

Fetching discord credentials is covered in detail in the [getting started guide](https://discord.com/developers/docs/getting-started).

Deploy to vercel

```bash
vercel --prod
```

Configure your discord bot to use the deployed app url + /interactions as the interaction endpoint in the discord developer portal.

### Commands available

An order is an object, with a set filters that will be used to buy axies

<!-- - */axie_info $AXIE_ID* - Get axie info -->
- */wallet* - Get bot wallet account info (ronin address, balance, etc)
- */axie_buy $AXIE_ID* - Buy the given axie
- */axie_sale $AXIE_ID $PRICE* - Create a sale order for the given axie
- */axie_sale_all $PRICE* - Create a sale order for all axies
- */axie_cancel_sale $AXIE_ID* - Cancel sale order for the given axie
- */axie_cancel_sale_all* - Cancel all sale orders
- */axie_transfer $AXIE_ID $ADDRESS* - Transfer axie to  the given address
- */axie_transfer_all $ADDRESS* - Transfer all axies to the given address

<!-- #### Screenshots

![/wallet](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/public/screenshots/wallet.png) | ![/axie_info](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/public/screenshots/axie_info.png)
--- | ---
![/axie_buy](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/public/screenshots/axie_buy.png) | ![/axie_sale](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/public/screenshots/axie_sale.png)
--- | ---
![axie_transfer](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/public/screenshots/Screenshot_Tx.png) | ![/axie_transfer](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/public/screenshots/Screenshot_TransferAll.png) -->

#### Contributing

Feel free to contribute to this project. Any help is appreciated!

#### TODO

- [ ] Add Screenshots
- [ ] Add axie info command, with floor price, rarity, etc
- [ ] Add web3auth-backend to generate wallets for users instead of using a single PK

#### License

[MIT]
