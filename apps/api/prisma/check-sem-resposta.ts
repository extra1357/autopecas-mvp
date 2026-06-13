import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.perguntaSemResposta.findMany({ orderBy: { criadoEm: 'desc' }, take: 10 })
  .then(r => { console.log(JSON.stringify(r, null, 2)); p.$disconnect(); });
