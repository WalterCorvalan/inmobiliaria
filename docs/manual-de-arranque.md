# Manual de arranque: armar un CRM nuevo con este método

Para pegarlo en una sesión nueva de Claude Code cuando se arranque otro CRM (por ejemplo, el de una concesionaria con stock y poco más). La idea: la sesión lee esto, pide los accesos que faltan y lo hace de punta a punta.

**Estado (3/11/2026): método probado solo en parte.** Todo se probó con tests y una base en memoria. Nunca se corrió contra un Supabase real ni contra Meta real. Lo marcado "sin probar" se corrige acá después del primer alta real.

## 1. Qué es este método

Se corta y se pega código de un CRM que ya funciona (Pfaffen, solo lectura) en un repositorio nuevo, se saca lo que no corresponde y se generaliza. No se reescribe de cero. Resultado de la primera vuelta (inmobiliarias): una micro app que junta los mensajes de WhatsApp, Instagram, Messenger y el chat de la web en un módulo de Leads, con resumen de IA, reparto entre asesores, oficinas, avisos y derivación.

Este repositorio (`waltercorvalan/inmobiliaria`) ya es esa base generalizada. **Para un CRM nuevo conviene partir de este repositorio y no de Pfaffen**: ya tiene cada dato atado a una empresa, la seguridad por fila y el bot sin catálogo.

## 2. Reglas de trabajo (las pidió Walter)

- Respuestas cortas, en español simple, sin jerga.
- Nunca pedir secretos: solo decir el nombre y dónde se sacan.
- No hacer nada en Google, Meta ni MercadoLibre sin el OK de Walter en el momento.
- El SQL va en `migraciones/` con vuelta atrás; lo corre Walter antes de subir el código que lo necesita.
- Lo decidido por Walter se anota en `docs/decisiones.md`; lo que falta, en una lista única.
- No conectar un cliente real hasta probar todo contra un Supabase real.
- Commit y push solo a la rama que se indique. Sin pull request si no se pide.

## 3. Orden de trabajo (las "pasadas")

1. **Leer y decidir.** Mapa de lo que se copia y lo que no (`docs/extraccion-leads-y-chats.md`), decisiones con Walter, alcance de la primera versión.
2. **Copia en bloque**, sin cambios, en un commit propio (`docs/origen-pfaffen.md`). Así se ve después qué se sacó.
3. **Pasada 1: podar.** Sacar módulos fuera de alcance, cambiar el vocabulario del rubro, quitar nombres propios. Meta: compila y pasan los tests.
4. **Pasada 2: empresa en cada dato.** Migraciones nuevas con `empresa_id` y seguridad por fila, más un test de aislamiento con dos empresas (`migraciones/tests/aislamiento.test.ts`).
5. **Pasada 2b: el código usa el esquema nuevo.** Todo acceso del servidor pasa por `lib/empresa/db.ts`. Credenciales de Meta por empresa, cifradas. Tareas automáticas que recorren las empresas.
6. **Bot neutro.** Prompt armado con el nombre del negocio, su descripción y su memoria; salida con formato fijo.
7. **Limpiar las pantallas** de todo lo que consulte tablas que no existen. Se comprueba comparando cada `.from("tabla")` del código con las migraciones.
8. **Probar con un Supabase real**, después conectar un canal (guía de canales) y recién entonces un cliente.

## 4. Lo que no se negocia (seguridad entre empresas)

- Toda tabla con `empresa_id` tiene seguridad por fila. Una tabla nueva sin eso hace fallar el test.
- El servidor no usa la clave de servicio suelta: usa `supabaseEmpresa` dentro de `dentroDeEmpresa(id, ...)`. Sin empresa fijada, falla en vez de leer todo.
- Tres tests lo vigilan: `migraciones/tests/aislamiento.test.ts`, `lib/empresa/db.test.ts` y `lib/empresa/guardia.test.ts`. No se cambian para que pasen: se arregla el código.
- Nadie cambia de empresa. Una empresa suspendida pierde el acceso. Solo el dueño ve y escribe las credenciales.
- El webhook sabe de qué empresa es cada mensaje por el verify token único de la dirección. La firma de Meta se comprueba con el secreto de esa empresa.

## 5. Cómo se verifica antes de dar algo por terminado

```bash
npm run typecheck
npm test
npm run lint:baseline
npm run check:migraciones
```

- El lint no puede subir. Si bajó, se actualiza el tope con `npm run lint:baseline -- --update`.
- Reglas de permisos y de negocio van en `lib/` como funciones puras con test, no en rutas ni componentes.
- Decir "arreglado" solo con la prueba a la vista.

## 6. Accesos que hay que darle a la sesión

Solo el nombre y dónde se sacan; los valores los carga Walter en el lugar correcto, nunca en el chat ni en el repositorio.

| Qué | Para qué | Dónde se saca |
|---|---|---|
| Repositorio de GitHub | trabajar y subir cambios | cuenta de Walter, repositorio nuevo |
| Supabase: URL, clave pública, clave de servicio | base de datos | proyecto nuevo en Supabase, Project Settings → API |
| `ENCRYPTION_KEY` | cifrar tokens | la genera Walter; si se pierde, hay que recargar todos los tokens |
| Clave de Anthropic | bot y resumen con IA | consola de Anthropic |
| Vercel | publicar | proyecto nuevo, a nombre de Walter |
| Meta (app, secreto, tokens) | canales | por empresa, ver `docs/guia-conexion-canales.md` |

Nombres exactos de las variables: todavía no hay `.env.example` en el repositorio (pendiente). Mientras tanto, buscarlas con `grep -rn process.env app lib`.

## 7. Errores que ya tuvimos (no repetir)

- Una consulta del servidor sin filtro de empresa lee datos de otra. Por eso existe `supabaseEmpresa` y el test guardia.
- Un objeto armado como `{empresa_id: e, ...datos}` dejaba pisar la empresa. El orden correcto es primero los datos y después `empresa_id`.
- Insertar un import al final del último `import` rompía los imports de varias líneas. Se inserta al principio del archivo.
- Borrar un trozo de JSX a mano dejó etiquetas sin cerrar. Después de cortar, correr `tsc` enseguida.
- Subir cambios con avisos de lint nuevos tumba el chequeo: corregirlos antes de subir.
- Las pruebas de la base: el entorno de pruebas da permisos que anulan los `revoke`; ojo al probar permisos.
- Se afirmó que la reasignación de leads no existía y sí existía: no afirmar sin mostrar el archivo.

## 8. Variante: CRM de concesionaria con stock

Idea de Walter: lo mismo, más simple, con leads, canales y stock.

- Partir de este repositorio. Tiene todo lo común (empresas, leads, canales, bot, seguridad).
- El stock se copia de Pfaffen (`app/panel/stock/` y su `ARCHITECTURE.md`, `lib/` relacionado), pasándolo por empresa igual que el resto: tabla con `empresa_id`, política de seguridad y entrada en la lista de `lib/empresa/db.ts`.
- En este repositorio se sacó de los chats la búsqueda de stock del bot y los vehículos de interés del lead. Si la concesionaria los quiere, se vuelven a sumar desde Pfaffen (ver `docs/extraccion-leads-y-chats.md`, sección "Dónde autos está metido en el código").
- Orígenes de cliente: lista cerrada propia de cada rubro, con test que la congela. La de inmobiliaria está en `lib/panel/origenesCliente.ts`; la de autos de Pfaffen es otra.
- Preguntas para Walter antes de arrancar: ¿una sola concesionaria o varias (SaaS)? ¿Qué entra en "poco más" además del stock? ¿Con o sin oficinas?

## 9. Pendientes conocidos de este método

1. Probar todo contra un Supabase real y conectar un canal real.
2. Panel de superadmin (alta de empresas sin SQL).
3. Código para pegar el chat en la web de cada cliente.
4. Memoria inicial del bot por empresa.
5. Que los tokens cifrados no se puedan leer desde el navegador.
6. Crear `.env.example` con los nombres de las variables, sin valores.

Lista viva: `docs/pasada-2-estado.md`.

## 10. Mapa de documentos

| Archivo | Para qué |
|---|---|
| `docs/decisiones.md` | lo que decidió Walter (no es un bug) |
| `docs/extraccion-leads-y-chats.md` | qué se copia, qué se parte, qué se reemplaza |
| `docs/origen-pfaffen.md` | de dónde salió la copia y qué no se copió |
| `docs/fase-3-diseno-base.md` | diseño de la base con empresa |
| `docs/pasada-2-estado.md` | estado, seguridad, cómo correr las migraciones |
| `docs/guia-conexion-canales.md` | conectar WhatsApp, Instagram y Messenger |
| `migraciones/README.md` | cómo se escriben las migraciones |
