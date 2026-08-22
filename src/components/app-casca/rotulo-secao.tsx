/**
 * Rótulo editorial de seção: sobrelinha em versalete e um fio fino.
 *
 * Serve para dar o ritmo de revista às telas do cliente — separa "a prática de
 * agora" de "informação de apoio" sem precisar de mais caixas na tela.
 */
export function RotuloSecao({ texto }: { texto: string }) {
  return (
    <div aria-hidden="true" className="mt-10 flex items-center gap-3 first:mt-0 sm:mt-12">
      <span className="rotulo-secao whitespace-nowrap">{texto}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
