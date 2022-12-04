import { CONTRACT_AXIE_ADDRESS } from '../../constants'
import { getRecentlyAxiesSold, getRecentlyErc1155Sold } from '../market'
import { createPgClient } from '../utils'

interface ISale {
  from_address: string
  to_address: string
  tx_hash: string
  price: string
  price_usd: string
  token_id: number
  token_address: string
  token_type: string
  created_at: number
  class?: string
  breedCount?: number
}

const insertOrUpdateAxie = async (id: number, breedCount: number, className: string, parts: string[]) => {
  const pgClient = createPgClient()
  try {
    await pgClient.connect()
    const res = await pgClient.query(
      'SELECT * FROM axies WHERE id = $1',
      [id]
    )
    if (res.rowCount === 0) {
      await pgClient.query(
        'INSERT INTO "axies" ("id", "breedcount", "class", "parts") VALUES ($1, $2, $3, $4)',
        [id, breedCount, className, parts]
      )
    } else if (res.rowCount === 1 && res.rows[0].breedcount !== breedCount) {
      await pgClient.query(
        'UPDATE axies SET breedcount = $1 WHERE id = $2',
        [breedCount, id]
      )
    }
    await pgClient.end()
  } catch (error) {
    console.log(error)
    await pgClient.end()
  }
}

// this script will check for the recent sales on the marketplace and save them to the postgress database
const marketRecentSalesTicker = async (blockNumber: number) => {
  const pgClient = createPgClient()
  try {
    // every block we will check for the recent sales on the marketplace of the different kinds of assets
    const assets = ['Axie', 'Rune', 'Charm']
    const from = 0
    const size = 100 // max 100

    await pgClient.connect()

    // get the recent sales of the different assets, we will scrape the last 100 sales or until we reach the last sale we have in the database
    for (const asset of assets) {
      const sales: ISale[] = []

      const assets = asset === 'Axie' ? await getRecentlyAxiesSold(from, size) : await getRecentlyErc1155Sold(asset, from, size)
      if (assets !== false) {
        // sales = assets.results.map((result: any) => {
        for (const result of assets.results) {
          // check if the sale is already in the database, if it is we will stop the loop
          const res = await pgClient.query(
            'SELECT * FROM recent_sales WHERE tx_hash = $1',
            [result.transferHistory.results[0].txHash]
          )
          if (res.rowCount === 0) {
            const sale: ISale = {
              from_address: result.transferHistory.results[0].from,
              to_address: result.transferHistory.results[0].to,
              tx_hash: result.transferHistory.results[0].txHash,
              price: result.transferHistory.results[0].withPrice,
              price_usd: result.transferHistory.results[0].withPriceUsd,
              token_id: Number(result.id),
              token_address: (result as any).tokenAddress ?? CONTRACT_AXIE_ADDRESS,
              token_type: asset, // Rune or Charm
              created_at: result.transferHistory.results[0].timestamp
            }
            if (asset === 'Axie') {
              sale.class = (result as any).class as string
              sale.breedCount = (result as any).breedCount as number
              const parts = (result as any).parts.map((part: any) => part.id)
              void insertOrUpdateAxie(Number(result.id), sale.breedCount, sale.class, parts)
            }
            sales.push(sale)
          } else {
            break
          }
        }
      }

      if (sales.length > 0) {
        console.log(`saving latest ${sales.length} ${asset} sales to the pg database`)
        // save the sales to the database
        await pgClient.query(
          `INSERT INTO recent_sales (from_address, to_address, tx_hash, price, price_usd, token_id, token_address, token_type, created_at) VALUES ${sales
            .map(
              (sale) => `('${sale.from_address}', '${sale.to_address}', '${sale.tx_hash}', '${sale.price}', '${sale.price_usd}', '${sale.token_id}', '${sale.token_address}', '${sale.token_type}', to_timestamp(${sale.created_at}))`
            )
            .join(',')} ON CONFLICT DO NOTHING`
        )
      }
    }
    await pgClient.end()
  } catch (error) {
    console.log(error)
    await pgClient.end()
  }
}

export default marketRecentSalesTicker
