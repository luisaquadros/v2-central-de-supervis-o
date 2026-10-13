/** Chave RSA de teste no formato do JSON de conta de serviço do Google (PKCS#8). Não é uma credencial real. */
export async function criarContaServicoDeTeste(email = 'conta-servico@projeto-teste.iam.gserviceaccount.com') {
  const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey));
  let bin = ''; for (const b of pkcs8) bin += String.fromCharCode(b);
  const pem = '-----BEGIN PRIVATE KEY-----\n' + btoa(bin).match(/.{1,64}/g)!.join('\n') + '\n-----END PRIVATE KEY-----\n';
  return { json: JSON.stringify({ type: 'service_account', client_email: email, private_key: pem }), publica: par.publicKey, email };
}
