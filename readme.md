# setup
configure your custom env
```
cp .env.example .env
```

## install dependencies
```
npm install
```
## start eveything
```
docker compose up
```
### hardhat tasks
```
npx hardhat accounts
npx hardhat generate-access-token
npx hardhat list --axie 10380830 --base-price 0.1 --ended-price 0.2 --duration 1 --access-token ACCESS_TOKEN
npx hardhat unlist --axie 10380830 
npx hardhat buy --order JSON.stringify(ITriggerOrder)
```


### bot commands:
```
- [x] Get axie info /axie
- [x] Automatically buy axies based on orders /add_order
- [x] Get open orders /get_orders
- [x] Remove order /remove_order ORDER_ID
- [ ] Cancel market order 
 - [x] hardhat unlist task
- [ ] List axie on marketplace /list
  - [x] hardhat list task
  - [x] hardhat list as an auction