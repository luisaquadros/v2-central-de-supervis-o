import assert from 'node:assert/strict';
import { acoesMobilePermitidas } from '../components/MobileBottomNav';

assert.deepEqual(acoesMobilePermitidas(true), ['hoje','turmas','aula','avaliacao','menu']);
assert.deepEqual(acoesMobilePermitidas(false), ['hoje','turmas','aula','menu']);
assert(!acoesMobilePermitidas(false).includes('avaliacao'));
assert(!acoesMobilePermitidas(Boolean(null)).includes('avaliacao'), 'perfil desconhecido não vê avaliações');
assert(acoesMobilePermitidas(false).includes('aula'), 'A monitora ainda pode abrir a supervisão.');
console.log('Navegação mobile: atalhos respeitam o perfil e mantêm o fluxo de aula.');
