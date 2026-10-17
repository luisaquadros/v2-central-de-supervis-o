import assert from 'node:assert/strict';
import { exigirPerfilLeitura } from '../services/leituraPermissoes';
import type { PerfilServidor } from '../services/escritaCoordenadaService';

const perfil = (papel: PerfilServidor['papel']): PerfilServidor =>
  ({ papel, email: 'teste@exemplo.com', turmas: [], operacoes: [], avisos: [] });
const admin = perfil('PROFESSORA_ADMIN');
const monitora = perfil('MONITORA');
assert.equal(exigirPerfilLeitura(admin), admin);
assert.equal(exigirPerfilLeitura(monitora), monitora);
assert.throws(() => exigirPerfilLeitura(null), /Acesso não confirmado/);
assert.throws(() => exigirPerfilLeitura(undefined as unknown as null), /Acesso não confirmado/);
assert.throws(() => exigirPerfilLeitura({ papel: 'QUALQUER' } as unknown as PerfilServidor), /Acesso não confirmado/);
console.log('Leitura oficial bloqueada quando o perfil do servidor não é válido.');
