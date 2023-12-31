import express, { Request, Response } from 'express'
import { VerifyDiscordRequest } from './utils'
import { interactionsHandler } from './interactions-handler'

import * as dotenv from 'dotenv'
dotenv.config()

const app = express()
app.use(express.static('public')) // https://vercel.com/guides/using-express-with-vercel#adding-a-public-directory

if (process.env.DISCORD_PUBLIC_KEY === undefined) {
  throw new Error('Missing environment variable DISCORD_PUBLIC_KEY')
}

app.use(express.json({ verify: VerifyDiscordRequest(process.env.DISCORD_PUBLIC_KEY) }))

app.get('/', (_req: Request, res: Response) => {
  return res.send('alexx855.ron axie serverless discord bot with @vercel/node 🚀')
})

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', (req: Request, res: Response) => {
  interactionsHandler(req, res).catch((err) => { console.error(err) })
})

const port = process.env.EXPRESS_PORT === undefined ? 3001 : process.env.EXPRESS_PORT
app.listen(port, () => {
  return console.log(`Server is listening on ${port}`)
})
