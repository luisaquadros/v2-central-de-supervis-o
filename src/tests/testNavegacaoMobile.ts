import assert from 'node:assert/strict';
import { acoesMobilePermitidas } from '../components/MobileBottomNav';

assert.deepEqual(acoesMobilePermitidas(false), ['hoje','turmas','aula','avaliacao','menu']);
assert.deepEqual(acoesMobilePermitidas(true), ['hoje','turmas','aula','menu']);
assert(!acoesMobilePermitidas(true).includes('avaliacao'));
assert(acoesMobilePermitidas(true).includes('aula'), 'A monitora ainda pode abrir a supervisão.');
console.log('Navegação mobile: atalhos respeitam o perfil e mantêm o fluxo de aula.');
