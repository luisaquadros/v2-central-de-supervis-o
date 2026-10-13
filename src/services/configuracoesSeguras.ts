/** Valores de configurações podem conter textos de estudantes e supervisão.
 * Nunca renderizar JSON operacional em painéis administrativos genéricos.
 */
export function valorConfiguracaoVisivel(chave: unknown, valor: unknown): string {
  const key = String(chave ?? '').trim().toUpperCase();
  const v = String(valor ?? '');
  if (key.startsWith('APP_OPERACIONAL_V1:') || key.startsWith('PENDENCIA_RESOLVIDA:'))
    return 'Registro operacional protegido';
  if (/^[\s]*[\[{]/.test(v)) return 'Conteúdo estruturado protegido';
  if (/TOKEN|SECRET|CREDENTIAL|PASSWORD|SENHA|CHAVE_PRIVADA|API_KEY|AUTH/i.test(key))
    return 'Valor protegido';
  return v || '—';
}
