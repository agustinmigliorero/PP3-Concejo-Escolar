from pydantic import BaseModel


# --- Reporte mensual --------------------------------------------------------

class ResumenMensualRow(BaseModel):
    ingrediente_id: int | None = None
    ingrediente_nombre: str
    unidad: str
    contenido_por_unidad: str | None = None
    unidad_contenido: str | None = None
    localidad_id: int | None = None
    localidad_nombre: str
    proveedor_id: int | None = None
    proveedor_nombre: str
    cantidad_total: str
    cantidad_contenido_total: str | None = None
    precio_promedio: str
    costo_total: str


class MontoLocalidad(BaseModel):
    localidad_id: int | None = None
    localidad_nombre: str
    costo_total: str
    porcentaje: float


class MontoProveedor(BaseModel):
    proveedor_id: int | None = None
    proveedor_nombre: str
    localidades: str
    costo_total: str
    porcentaje: float


class MontoEscuela(BaseModel):
    escuela_id: int | None = None
    codigo: str
    nombre: str
    localidad_nombre: str
    costo_total: str
    porcentaje: float


class MontoIngrediente(BaseModel):
    ingrediente_id: int | None = None
    ingrediente_nombre: str
    costo_total: str
    porcentaje: float


class MontoTipo(BaseModel):
    tipo: str
    tipo_label: str
    num_pedidos: int
    costo_total: str
    porcentaje: float


class PedidoIncluido(BaseModel):
    id: int
    fecha: str
    tipo: str
    tipo_label: str
    detalle: str
    costo_total: str


class ReporteMensualResponse(BaseModel):
    anio: int
    mes: int
    etiqueta: str
    tipo: str | None = None
    num_pedidos: int
    costo_total: str
    resumen: list[ResumenMensualRow]
    por_proveedor: list[MontoProveedor]
    por_localidad: list[MontoLocalidad]
    por_escuela: list[MontoEscuela]
    por_tipo: list[MontoTipo]
    pedidos: list[PedidoIncluido]


class MesDisponible(BaseModel):
    anio: int
    mes: int
    etiqueta: str
    num_pedidos: int
    costo_total: str


# --- Estadisticas -----------------------------------------------------------

class TendenciaPunto(BaseModel):
    anio: int
    mes: int
    etiqueta: str
    costo_total: str
    num_pedidos: int


class EstadisticasTotales(BaseModel):
    costo_total: str
    num_pedidos: int
    num_escuelas: int
    num_proveedores: int
    num_localidades: int
    costo_promedio_pedido: str
    mes_pico_etiqueta: str | None = None
    mes_pico_costo: str | None = None


class EstadisticasResponse(BaseModel):
    anio: int | None = None
    tipo: str | None = None
    anios: list[int]
    totales: EstadisticasTotales
    tendencia: list[TendenciaPunto]
    por_localidad: list[MontoLocalidad]
    por_proveedor: list[MontoProveedor]
    top_ingredientes: list[MontoIngrediente]
    por_tipo: list[MontoTipo]
