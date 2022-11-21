# Discord bot that automatically buy Axies from the marketplace based on the given criteria.
## It can also be used to sell (list/unlist) Axies on the marketplace through the hardhat tasks.
|/axie|/add order|/get and remove orders|
|-|-|-|
|[![name](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Axie.png)](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Axie.png)|[![name](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Modal.png)](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Modal.png)|[![name](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Orders.png)](https://raw.githubusercontent.com/alexx855/axie-discord-bot/master/screenshots/Screenshot_Orders.png) |

### Setup
Configure your custom env keys and tokens
https://discord.com/developers/docs/intro
https://hardhat.org/docs
```bash
cp .env.example .env
```

### Start node bot and redis from docker compose
(Optional) if you want to use the devcontainer https://code.visualstudio.com/docs/devcontainers/containers
```bash
docker compose up
```

### Hardhat tasks
- *account* - list account balances
- *generate-access-token* - generate marketplace access token
- *list* - list an axie on the marketplace (requires access token)
- *unlist* - unlist an axie on the marketplace
- *buy* - buy an axie on the marketplace (requires a JSON order from the marketplace)

```bash
npx hardhat accounts
npx hardhat generate-access-token
npx hardhat list --axie $AXIE_ID --base-price 0.1 --ended-price 0.2 --duration 1 --access-token $ACCESS_TOKEN
npx hardhat unlist --axie $AXIE_ID 
npx hardhat buy --order JSON.stringify(IMarketBuyOrder)
```

### Discord bot commands:
- */axie $AXIE_ID* - Get axie info
- */add_order* - Create an order that automatically buy axie's based on the given price and the marketplace url filters 
- */get_orders* - Get open orders, this how you get the order ID
- */remove_order $ORDER_ID* - Remove order by ID
- **TODO: /list - List axie's on the marketplace**
- **TODO: /unlist - batch unlist axies auctions**