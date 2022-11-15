# setup
configure your custom env keys and tokens
```bash
cp .env.example .env
```

## start bot and db using docker compose, or the devcontainer
https://code.visualstudio.com/docs/devcontainers/containers
```bash
docker compose up
```
### hardhat tasks
- *account* - list account balances
- *generate-access-token* - generate marketplace access token
- *list* - list an axie on the marketplace (requires access token)
- *unlist* - unlist an axie on the marketplace
- *buy* - buy an axie on the marketplace

```bash
npx hardhat accounts
npx hardhat generate-access-token
npx hardhat list --axie $AXIE_ID --base-price 0.1 --ended-price 0.2 --duration 1 --access-token $ACCESS_TOKEN
npx hardhat unlist --axie $AXIE_ID 
npx hardhat buy --order JSON.stringify(ITriggerOrder)
```

### discord bot commands:
- */axie* $AXIE_ID Get axie info
- */add_order* Automatically buy axies by filters from the marketplace url 
- */add_order* Automatically buy axies by filters from the marketplace url 
- */get_orders* Get open orders
- */remove_order* $ORDER_ID Remove order
