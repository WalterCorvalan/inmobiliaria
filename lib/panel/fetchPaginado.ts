// PostgREST corta cualquier select en 1000 filas (db.max_rows) sin importar
// qué .limit() se pida -- con la base real ya arriba de los 1000 clientes,
// cualquier fetch simple de una tabla grande pierde todo lo que caiga
// después del corte, sin avisar. Pagina con .range() hasta agotar la tabla.
//
// `build` arma la query desde cero (select/eq/order, sin range) -- se llama
// de nuevo en cada vuelta porque un query builder de supabase-js no se
// puede reusar entre awaits.
//
// La primera página va sola (casi todas las tablas caben en ella). Si vino llena, las siguientes se piden de a
// 4 en paralelo en vez de una por una: una tabla de 5.000 filas pasa de 5 viajes seguidos a 2.
export async function fetchPaginado<T = any>(build: () => any): Promise<T[]> {
  const PAGINA = 1000;
  const PARALELAS = 4;
  const primera = await build().range(0, PAGINA - 1);
  if (primera.error || !primera.data) return [];
  let todos: T[] = primera.data as T[];
  if (primera.data.length < PAGINA) return todos;

  let desde = PAGINA;
  while (true) {
    const lote = await Promise.all(
      Array.from({ length: PARALELAS }, (_, k) => build().range(desde + k * PAGINA, desde + (k + 1) * PAGINA - 1)),
    );
    for (const { data, error } of lote) {
      if (error || !data) return todos;
      todos = todos.concat(data as T[]);
      if (data.length < PAGINA) return todos;
    }
    desde += PARALELAS * PAGINA;
  }
}
