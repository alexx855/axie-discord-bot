import { readFile } from 'node:fs/promises'
import { createPgClient } from '../src/utils'
import * as dotenv from 'dotenv'
dotenv.config()

const createTables = async () => {
  console.log('Creating tables...')
  const pg = createPgClient()
  await pg.connect()
  const query = await readFile('./scripts/tables.sql', 'utf-8')
  await pg.query(query)
  await pg.end()
}

const tableExists = async (tableName: string) => {
  try {
    const pg = createPgClient()
    await pg.connect()
    const res = await pg.query(
      'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
      [tableName]
    )
    await pg.end()
    return Boolean(res.rows[0].exists)
  } catch (error) {
    console.log(error)
  }

  return false
}


async function main() {
  const recentSalesTableExists = await tableExists('recent_sales')
  if (!recentSalesTableExists) {
    await createTables()
  }

  process.exit(0)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
  process.exit()
})
