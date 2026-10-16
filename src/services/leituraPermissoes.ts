import type { PerfilServidor } from './escritaCoordenadaService';

/**
 * Falha fechada: uma conta sem perfil confirmado pelo Worker não pode escolher
 * a leitura direta do Google Sheets (nem aproveitar um token OAuth antigo).
 */
export function exigirPerfilLeitura(perfil: PerfilServidor | null): PerfilServidor {
  if (perfil?.papel !== 'PROFESSORA_ADMIN' && perfil?.papel !== 'MONITORA') {
    throw new Error('Acesso não confirmado pelo servidor. Entre novamente ou verifique as permissões da sua conta.');
  }
  return perfil;
}
