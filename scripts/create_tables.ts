import { readFile } from 'node:fs/promises'
import * as dotenv from 'dotenv'
import { createPgClient } from '../src/utils'
dotenv.config()

const createTables = async () => {
  const pgClient = createPgClient()
  console.log('creating tables')
  const query = await readFile('./scripts/tables.sql', 'utf-8')
  await pgClient.connect()
  await pgClient.query(query)
  await pgClient.end()
}

const tableExists = async (tableName: string) => {
  const pgClient = createPgClient()
  try {
    await pgClient.connect()
    const res = await pgClient.query(
      'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
      [tableName]
    )
    await pgClient.end()
    return Boolean(res.rows[0].exists)
  } catch (error) {
    console.log(error)
    await pgClient.end()
    return false
  }
}

const importRunes = async () => {
  console.log('importing runes')
  const runes = JSON.parse(await readFile('./scripts/runes.json', 'utf-8'))
  // map and insert the runes to the database into the table items
  const values = runes.map((rune: any) => {
    return [
      rune.item.id,
      rune.class,
      rune.item.category,
      rune.item.rarity,
      rune.item.description,
      rune.item.name,
      rune.item.tokenId,
      rune.item.tokenAddress,
      rune.item.imageUrl
    ]
  })

  // filter non NFTs runes, doesnt have tokenId
  const filteredValues: any = values.filter((value: string) => value[6] !== '')

  // insert the runes into the database
  const pgClient = createPgClient()
  await pgClient.connect()

  for (const value of filteredValues) {
    await pgClient.query(
      'INSERT INTO items (id, class, category, rarity, description, name, token_id, token_address, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      value
    )
  }
  await pgClient.end()
}

const importCharms = async () => {
  console.log('importing charms')
  const charms = JSON.parse(await readFile('./scripts/charms.json', 'utf-8'))
  // map and insert the charms to the database into the table items
  const values = charms.map((charm: any) => {
    return [
      charm.item.id,
      charm.class,
      charm.item.category,
      charm.item.rarity,
      charm.item.description,
      charm.item.name,
      charm.item.tokenId,
      charm.item.tokenAddress,
      charm.item.imageUrl
    ]
  })

  // filter non NFTs charms, doesnt have tokenId
  const filteredValues: any = values.filter((value: string) => value[6] !== '')

  // insert the charms into the database
  const pgClient = createPgClient()
  await pgClient.connect()

  for (const value of filteredValues) {
    await pgClient.query(
      'INSERT INTO items (id, class, category, rarity, description, name, token_id, token_address, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      value
    )
  }
  await pgClient.end()
}

const importCards = async () => {
  console.log('importing cards')
  const cards = JSON.parse(await readFile('./scripts/cards.json', 'utf-8'))
  // map and insert the cards to the database into the table cards

  const values = cards.map((card: any) => {
    return [
      card.id,
      card.name,
      card.description,
      card.partClass,
      card.partType,
      card.partValue,
      card.energy,
      card.attack,
      card.defense,
      card.healing,
      card.abilityType,
      card.level,
      card.tags
    ]
  })

  // insert the cards into the database
  const pgClient = createPgClient()
  await pgClient.connect()

  for (const value of values) {
    await pgClient.query(
      'INSERT INTO cards (id, name, description, part_class, part_type, part_value, energy, attack, defense, healing, ability_type, level, tags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
      value
    )
  }

  await pgClient.end()
}

async function main() {
  const pgClient = createPgClient()
  await pgClient.connect()

  const recentSalesTableExists = await tableExists('recent_sales')
  if (!recentSalesTableExists) {
    console.log('tables do not exist, creating tables')
    await createTables()
  }

  // import updated season data from json files
  await importRunes()
  await importCharms()
  await importCards()

  await pgClient.end()
  process.exit(0)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
  process.exit()
})
