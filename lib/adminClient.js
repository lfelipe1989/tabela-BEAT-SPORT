// Guarda a senha de admin na sessionStorage do navegador para não
// precisar digitar toda hora. Isso é uma trava simples de UI, não
// segurança de verdade — a segurança real está nas API routes, que
// conferem essa senha no servidor antes de usar a service_role key.
export function getAdminPassword() {
  if (typeof window === 'undefined') return '';
  let pw = window.sessionStorage.getItem('admin_password');
  if (!pw) {
    pw = window.prompt('Senha de administrador (para cadastrar/editar dados):') || '';
    window.sessionStorage.setItem('admin_password', pw);
  }
  return pw;
}

export function clearAdminPassword() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem('admin_password');
}
