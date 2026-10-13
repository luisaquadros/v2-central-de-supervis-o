// Gera uma conta de serviço FALSA (chave RSA descartável) para o teste local. Não é credencial real.
import { writeFileSync } from 'node:fs';
import { criarContaServicoDeTeste } from '../../src/tests/ajudaContaServico';
const cs = await criarContaServicoDeTeste();
writeFileSync(process.argv[2], JSON.stringify(JSON.parse(cs.json)));   // uma linha só
console.log('conta de serviço de teste gerada');
