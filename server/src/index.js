import 'dotenv/config'
import { app } from './app.js'
import { prisma } from './db/prisma.js'

const port = Number(process.env.PORT ?? 3000)
const server = app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
