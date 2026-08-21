"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UserInfo } from "@/lib/api";

type Role = UserInfo["role"];

interface ManualModalProps {
  role: Role;
  onClose: () => void;
}

interface ManualSection {
  id: string;
  title: string;
  roles: Role[] | "all";
  node: React.ReactNode;
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-3 space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {index + 1}
          </span>
          <span className="text-sm leading-6 text-slate-700">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
          <span className="text-sm leading-6 text-slate-700">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
      <span className="font-bold">Consejo: </span>
      {children}
    </div>
  );
}

function Term({ word, children }: { word: string; children: React.ReactNode }) {
  return (
    <p className="text-sm leading-6 text-slate-700">
      <span className="font-semibold text-slate-900">{word}: </span>
      {children}
    </p>
  );
}

function buildSections(role: Role): ManualSection[] {
  const all: ManualSection[] = [
    {
      id: "bienvenida",
      title: "¿Qué es este sistema?",
      roles: "all",
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Es el sistema del <strong>Consejo Escolar de Azul</strong> para gestionar los
            pedidos de comida del Servicio Alimentario Escolar (SAE). Reúne en un solo lugar
            las escuelas, los ingredientes, los proveedores, los precios y los menús; y con
            todo eso <strong>genera automáticamente las órdenes de compra de cada semana</strong>.
          </p>
          <Bullets
            items={[
              <>Cargás la información <strong>una sola vez</strong> y la mantenés actualizada cuando algo cambia.</>,
              <>El sistema hace las cuentas por vos: cuánto pedir por escuela, descuenta el stock que sobró y aplica los precios de cada proveedor.</>,
              <>Como resultado entrega <strong>un documento por proveedor</strong> y un <strong>resumen global</strong>, en PDF y Excel.</>,
            ]}
          />
          <Tip>
            Si es tu primera vez, leé el apartado <em>&ldquo;Cómo funciona, paso a paso&rdquo;</em>{" "}
            de abajo. Explica en qué orden se usan las pestañas.
          </Tip>
        </>
      ),
    },
    {
      id: "flujo",
      title: "Cómo funciona, paso a paso",
      roles: "all",
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            De principio a fin, el sistema se usa en este orden. Los primeros pasos se hacen
            una vez (y se actualizan cuando hay cambios); el último se repite cada semana.
          </p>
          <Steps
            items={[
              <><strong>Datos base.</strong> Se cargan las <em>Localidades</em>, las <em>Escuelas</em> (con su matrícula y qué comidas ofrecen), los <em>Ingredientes</em>, los <em>Proveedores</em> y los <em>precios</em> (en <em>Asignaciones</em>: qué proveedor provee cada ingrediente en cada localidad y a qué valor).</>,
              <><strong>Comidas y recetas.</strong> Se definen los <em>Tipos de comida</em> (desayuno, almuerzo, merienda…) y las <em>Recetas</em> (cada plato con sus ingredientes y la cantidad por porción).</>,
              <><strong>Temporada y menú.</strong> Se crea la <em>Temporada</em> (Verano/Invierno + año) y, dentro, las 2 opciones de menú (semana A y B). En <em>Menús</em> se asigna una receta a cada día y cada comida.</>,
              <><strong>Pedido semanal.</strong> En <em>Pedidos</em> se elige la semana, la opción de menú y los días hábiles. El sistema calcula las cantidades por escuela, descuenta el stock previo, agrupa por proveedor y genera los documentos.</>,
              <><strong>En paralelo, las escuelas</strong> mantienen su matrícula al día y cargan el <em>stock</em> que les sobró, para que el próximo pedido lo descuente.</>,
            ]}
          />
          <Tip>
            La primera vez el orden importa: no se puede armar un menú sin recetas, ni recetas
            sin ingredientes, ni un pedido sin precios cargados.
          </Tip>
        </>
      ),
    },
    {
      id: "navegacion",
      title: "Cómo moverte por el sistema",
      roles: "all",
      node: (
        <Bullets
          items={[
            <><strong>Menú lateral izquierdo</strong> (en computadora) o <strong>barra superior</strong> (en celular): son las pestañas. Cada una abre una pantalla. Lo que ves depende de tu rol.</>,
            <><strong>Barra de arriba:</strong> muestra el nombre de la pantalla actual, tu usuario y rol, el botón <em>Manual</em> (este) y <em>Cerrar sesión</em>.</>,
            <>La <strong>pestaña activa</strong> queda resaltada en azul, para que siempre sepas dónde estás.</>,
            <>Para salir del sistema usá <strong>Cerrar sesión</strong> (abajo a la izquierda, o &ldquo;Salir&rdquo; arriba en celular).</>,
          ]}
        />
      ),
    },
    {
      id: "roles",
      title: "Quién puede hacer qué (roles)",
      roles: ["admin", "gestor"],
      node: (
        <Bullets
          items={[
            <><strong>Administrador:</strong> acceso total. Configura todo (usuarios, datos base, recetas, menús) y genera pedidos.</>,
            <><strong>Gestor:</strong> opera el día a día. Gestiona escuelas y genera pedidos. Consulta ingredientes y localidades (no los crea).</>,
            <><strong>Escuela:</strong> solo su propia escuela. Actualiza su matrícula y contacto, carga el stock que le sobró y ve el historial de sus pedidos.</>,
          ]}
        />
      ),
    },
    {
      id: "inicio",
      title: "Inicio",
      roles: "all",
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Es la pantalla de bienvenida. Muestra tu usuario y rol, y unos{" "}
            <strong>&ldquo;Accesos frecuentes&rdquo;</strong>: atajos a las tareas más comunes
            según tu rol.
          </p>
          {role === "escuela" && (
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Además muestra los datos de tu <strong>escuela asociada</strong> (código, nombre,
              localidad y matrícula actual).
            </p>
          )}
        </>
      ),
    },
    {
      id: "usuarios",
      title: "Usuarios",
      roles: ["admin"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Acá se administran las personas que entran al sistema.
          </p>
          <Bullets
            items={[
              <><strong>Crear usuario:</strong> usuario, contraseña y rol. Si el rol es <em>Escuela</em>, elegís a qué escuela queda asociado (1 usuario = 1 escuela).</>,
              <><strong>Editar:</strong> cambiar el nombre de usuario, el rol o resetear la contraseña.</>,
              <><strong>Activar / desactivar:</strong> en lugar de borrar, se desactivan (no pueden entrar, pero queda el registro). Solo se pueden eliminar definitivamente los que ya están inactivos.</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "localidades",
      title: "Localidades",
      roles: ["admin", "gestor"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Son las localidades del partido de Azul (Azul, Cacharí, Chillar…). Cada escuela
            pertenece a una localidad, y los <strong>precios de los ingredientes se definen por
            localidad</strong>.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {role === "admin"
              ? "El administrador crea y edita las localidades."
              : "Como gestor, esta pantalla es de consulta: el alta y la edición las realiza el administrador."}
          </p>
        </>
      ),
    },
    {
      id: "ingredientes",
      title: "Ingredientes",
      roles: ["admin", "gestor"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Es la lista de insumos que usan las recetas (leche, azúcar, pollo…). Cada
            ingrediente tiene algunos datos clave para que las cuentas salgan bien:
          </p>
          <Bullets
            items={[
              <><strong>Unidad de medida:</strong> kg, litros, gramos, unidades, etc.</>,
              <><strong>Contenido por unidad</strong> (solo si la unidad es &ldquo;unidades&rdquo;): cuánto trae cada envase. Ej: una botella trae 900 ml. Sirve para que el pedido se exprese en botellas/paquetes enteros.</>,
              <><strong>Índice de corrección:</strong> factor por desperdicio. Ej: pollo con hueso 1,68 → por cada 100 g de receta se piden 168 g. Por defecto es 1 (sin corrección).</>,
            ]}
          />
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {role === "admin"
              ? "El administrador crea, edita y desactiva ingredientes."
              : "Como gestor, esta pantalla es de consulta: el alta y la edición las realiza el administrador."}
          </p>
        </>
      ),
    },
    {
      id: "proveedores",
      title: "Proveedores",
      roles: ["admin"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Son las empresas que proveen los ingredientes, con sus datos de contacto.
          </p>
          <Bullets
            items={[
              <>Crear, editar y desactivar proveedores.</>,
              <>Desde acá también podés ver qué provee cada uno (sus asignaciones) y el historial.</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "asignaciones",
      title: "Asignaciones (precios)",
      roles: ["admin"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Es donde viven los <strong>precios</strong>. Una asignación define, para un{" "}
            <strong>ingrediente en una localidad</strong>, qué <strong>proveedor</strong> lo
            provee y a qué <strong>precio unitario</strong>, con su vigencia (desde / hasta).
          </p>
          <Tip>
            Por cada combinación (ingrediente + localidad) hay <strong>una sola</strong>{" "}
            asignación vigente. Cuando cargás una nueva (por ejemplo, una nueva licitación), la
            anterior se cierra automáticamente y queda en el historial. No hace falta borrar
            nada.
          </Tip>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Si un ingrediente no tiene proveedor vigente en una localidad, ese ingrediente
            queda fuera del pedido y el sistema te lo avisa aparte para resolverlo a mano.
          </p>
        </>
      ),
    },
    {
      id: "tipos-comida",
      title: "Tipos de comida",
      roles: ["admin"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Es el catálogo de tipos de comida: Desayuno, Almuerzo, Merienda y los que quieras
            agregar. Sirve para <strong>clasificar las recetas</strong> y para indicar{" "}
            <strong>qué comidas ofrece cada escuela</strong>.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Los creás una vez (crear / renombrar / desactivar) y después aparecen disponibles en
            Recetas, Escuelas y Menús.
          </p>
        </>
      ),
    },
    {
      id: "recetas",
      title: "Recetas",
      roles: ["admin"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Cada receta es una preparación (ej: &ldquo;Fideos con estofado + postre&rdquo;) con
            la lista de ingredientes y la <strong>cantidad por porción</strong> (una porción =
            el promedio de un alumno).
          </p>
          <Steps
            items={[
              <>Creás la receta con su nombre.</>,
              <>Le asignás uno o más <strong>tipos de comida</strong>.</>,
              <>Agregás cada <strong>ingrediente</strong> con su cantidad por porción (en la unidad del ingrediente).</>,
            ]}
          />
          <Tip>
            Las cantidades son <strong>por una sola porción</strong>. El sistema las multiplica
            después por la matrícula de cada escuela y por los días, así que no hace falta
            calcular nada a mano.
          </Tip>
        </>
      ),
    },
    {
      id: "temporadas",
      title: "Temporadas",
      roles: ["admin"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Una temporada es Verano o Invierno + el año. Define qué menú está vigente.
          </p>
          <Bullets
            items={[
              <>Solo puede haber <strong>una temporada activa a la vez</strong>: al activar una nueva, la anterior se desactiva sola.</>,
              <>La temporada activa es la que aparece <strong>preseleccionada</strong> al generar pedidos.</>,
              <>Cada temporada tiene <strong>2 opciones de menú</strong> (semana A y semana B).</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "menus",
      title: "Menús",
      roles: ["admin"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Es la <strong>grilla semanal</strong>. Para cada opción de menú asignás qué receta
            va en cada día (Lunes a Viernes) y cada comida.
          </p>
          <Steps
            items={[
              <>Elegís la <strong>temporada</strong> y la <strong>opción</strong> (A o B).</>,
              <>Completás la grilla: las filas son los días y las columnas las comidas.</>,
              <>En cada casillero elegís una receta del tipo de comida correspondiente.</>,
            ]}
          />
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Esto es lo que el cálculo del pedido usa para saber qué se cocina cada día.
          </p>
        </>
      ),
    },
    {
      id: "escuelas",
      title: "Escuelas",
      roles: ["admin", "gestor"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Es el registro de escuelas: código, nombre, localidad, matrícula y qué comidas
            ofrece.
          </p>
          <Bullets
            items={[
              <>Crear y editar escuelas.</>,
              <>Mantener la <strong>matrícula</strong> al día (cambia directamente cuánto se pide).</>,
              <>Indicar qué <strong>tipos de comida</strong> ofrece cada escuela.</>,
              <><strong>Activar / desactivar:</strong> las escuelas inactivas no entran en los pedidos.</>,
              <>Al entrar a una escuela ves su detalle y su stock previo.</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "mi-escuela",
      title: "Mi escuela",
      roles: ["escuela"],
      node: (
        <>
          <p className="text-sm leading-6 text-slate-700">
            Es tu panel. Acá administrás los datos de <strong>tu propia escuela</strong>. Es
            importante mantenerlo al día porque alimenta el cálculo de los pedidos.
          </p>
          <Bullets
            items={[
              <><strong>Actualizar la matrícula</strong> (cantidad de alumnos) cuando cambie. Afecta directamente las cantidades que se piden.</>,
              <><strong>Editar el contacto:</strong> teléfono y email (ambos opcionales).</>,
              <><strong>Cargar el stock previo:</strong> lo que te sobró de cada ingrediente. El sistema lo descuenta del próximo pedido. Se carga en la unidad de cada ingrediente y, al generarse el pedido, vuelve a 0.</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "pedidos",
      title: "Pedidos",
      roles: "all",
      node:
        role === "escuela" ? (
          <>
            <p className="text-sm leading-6 text-slate-700">
              Acá ves el <strong>historial de pedidos que incluyen a tu escuela</strong>. Podés
              abrir y <strong>descargar</strong> los documentos con las filas correspondientes a
              tu escuela.
            </p>
            <Tip>
              Vos no generás pedidos: eso lo hace el Consejo (administrador o gestor). Tu parte
              es mantener la <strong>matrícula</strong> y el <strong>stock</strong> al día para
              que el cálculo salga correcto.
            </Tip>
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-slate-700">
              Es donde se <strong>generan las órdenes de compra</strong> de la semana y se
              consulta el historial. Tiene dos solapas: <em>Generar pedido</em> e{" "}
              <em>Historial y reportes</em>.
            </p>
            <p className="mt-4 text-sm font-bold text-slate-900">Generar pedido (3 pasos)</p>
            <Steps
              items={[
                <><strong>Configurar:</strong> elegís la semana (lunes de inicio) y la opción de menú; activás o desactivás los <strong>días hábiles</strong> (si hay feriado o paro, desactivás ese día y no se suma). Opcional: cargás o editás el <strong>stock previo</strong> de las escuelas (viene precargado con lo que cada escuela informó).</>,
                <><strong>Previsualizar:</strong> el sistema calcula las cantidades por escuela y por proveedor, descuenta el stock y te muestra el resultado, con <strong>advertencias</strong> si algún ingrediente no tiene proveedor.</>,
                <><strong>Confirmar:</strong> el pedido queda guardado en el historial (ya no se modifica) y el stock de las escuelas incluidas vuelve a 0.</>,
              ]}
            />
            <p className="mt-4 text-sm font-bold text-slate-900">Descargas</p>
            <Bullets
              items={[
                <><strong>Resumen PDF / Excel:</strong> el resumen global (todos los ingredientes y escuelas, con precios y costo total).</>,
                <><strong>Órdenes PDF / Excel (ZIP):</strong> un documento por proveedor, listo para enviar.</>,
              ]}
            />
            <p className="mt-4 text-sm leading-6 text-slate-700">
              <strong>Historial y reportes:</strong> lista de pedidos ya generados. Podés volver
              a descargar <strong>exactamente</strong> los documentos originales de cualquier
              pedido anterior.
            </p>
          </>
        ),
    },
    {
      id: "glosario",
      title: "Glosario rápido",
      roles: "all",
      node: (
        <div className="space-y-2.5">
          <Term word="Matrícula">cantidad de alumnos de la escuela. Multiplica las cantidades del pedido.</Term>
          <Term word="Porción">cantidad de un ingrediente para un alumno. Se define en cada receta.</Term>
          <Term word="Stock previo">lo que le sobró a la escuela; se descuenta del próximo pedido.</Term>
          <Term word="Opción de menú">cada temporada tiene 2 (semana A y B). Se elige una por semana.</Term>
          <Term word="Días hábiles">los días con clases de la semana; solo esos se suman al calcular.</Term>
          <Term word="Índice de corrección">factor por desperdicio de un ingrediente (ej. 1,68 para pollo con hueso).</Term>
          <Term word="Asignación / precio vigente">el proveedor y el precio actuales de un ingrediente en una localidad.</Term>
          <Term word="Snapshot">la &ldquo;foto&rdquo; de precios y cantidades que se guarda al confirmar, para poder re-descargar un pedido idéntico al original.</Term>
        </div>
      ),
    },
  ];

  return all.filter((section) => section.roles === "all" || section.roles.includes(role));
}

export function ManualModal({ role, onClose }: ManualModalProps) {
  const sections = useMemo(() => buildSections(role), [role]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function scrollTo(id: string) {
    const container = contentRef.current;
    const target = container?.querySelector<HTMLElement>(`#manual-${id}`);
    if (container && target) {
      container.scrollTo({ top: target.offsetTop - 8, behavior: "smooth" });
      setActive(id);
    }
  }

  function handleScroll() {
    const container = contentRef.current;
    if (!container) return;
    let current = sections[0]?.id ?? "";
    for (const section of sections) {
      const target = container.querySelector<HTMLElement>(`#manual-${section.id}`);
      if (target && target.offsetTop - container.scrollTop <= 96) {
        current = section.id;
      }
    }
    setActive(current);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Consejo Escolar
            </p>
            <h2 id="manual-title" className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl">
              Manual de uso
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Guía para usar el sistema, pestaña por pestaña.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar manual"
            className="shrink-0 rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
          <nav
            className="hidden overflow-y-auto border-r border-slate-200 bg-slate-50 px-3 py-4 lg:block"
            aria-label="Índice del manual"
          >
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollTo(section.id)}
                aria-current={active === section.id ? "true" : undefined}
                className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  active === section.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {section.title}
              </button>
            ))}
          </nav>

          <div
            ref={contentRef}
            onScroll={handleScroll}
            className="relative min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"
          >
            {sections.map((section) => (
              <section
                key={section.id}
                id={`manual-${section.id}`}
                className="mb-8 scroll-mt-4 border-b border-slate-100 pb-6 last:border-b-0"
              >
                <h3 className="mb-1 text-base font-bold text-slate-900 sm:text-lg">
                  {section.title}
                </h3>
                {section.node}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
