import app from './app.js';
import { prisma } from './config/prisma.js';

const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
  console.log(`Shaha recovery API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

