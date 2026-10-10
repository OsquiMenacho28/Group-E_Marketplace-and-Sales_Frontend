export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
  padre_id?: string;
}

export interface Variante {
  id: string;
  producto_id: string;
  sku: string;
  nombre_variante: string;
  atributos: Record<string, any>;
  precio: number;
  precio_costo?: number;
  codigo_barras?: string;
}

export interface ImagenProducto {
  id: string;
  producto_id: string;
  variante_id?: string | null;
  url: string;
  thumbnailUrl?: string;
  es_principal: boolean;
  orden: number;
  created_at?: string;
  stats?: {
    nombreOriginal?: string;
    pesoOriginalBytes?: number;
    pesoOptimizadoBytes?: number;
    pesoThumbnailBytes?: number;
    porcentajeAhorro?: number;
  };
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  marca?: string;
  categoria_id: string;
  estado: string;
  variantes?: Variante[];
  categorias?: { id: string; nombre: string };
  imagenes_producto?: ImagenProducto[];
  precio?: number;
  precio_costo?: number;
  variante_id?: string;
  stock?: number;
}

export interface ItemCarrito {
  variante_id: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  stock_disponible?: number;
  total_linea: number;
}

export interface Carrito {
  cliente_o_sesion_id: string;
  items: ItemCarrito[];
  subtotal: number;
  descuento_cupon: number;
  cupon_codigo?: string;
  total: number;
}

export type UserRole = 'cliente' | 'cajero' | 'administrador' | 'gerente_comercial';

export interface UserProfile {
  id: string;
  user_id?: string;
  nombre_completo: string;
  email: string;
  telefono?: string;
  nit_ci?: string;
  razon_social?: string;
  tipo_cliente?: string;
  role: UserRole;
  sucursal_id?: string | null;
  puntos_saldo: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  nombre_completo: string;
  email: string;
  password: string;
  telefono?: string;
  nit_ci?: string;
  razon_social?: string;
  tipo_cliente?: string;
}

export interface OrderSummary {
  id: string;
  codigo: string;
  fecha: string;
  total: number;
  estado: 'pendiente' | 'confirmada' | 'en_preparacion' | 'despachada' | 'entregada' | 'cancelada';
  items_count: number;
  metodo_pago: string;
}

export interface WishlistItem {
  id: string;
  cliente_id?: string;
  variante_id: string;
  created_at: string;
  sku?: string;
  nombre?: string;
  precio?: number;
  imagen_url?: string;
}

// ============================================================================
// HISTORIA KAN-346 / KAN-13: DATOS FISCALES Y FACTURACIÓN ELECTRÓNICA
// ============================================================================
export type TipoDocumentoFiscal = 'NIT' | 'CI' | 'CEX' | 'PAS';

export interface DatosFiscales {
  modalidad: 'con_factura' | 'sin_factura';
  tipo_documento: TipoDocumentoFiscal;
  nit_ci: string;
  razon_social: string;
  email_facturacion?: string;
  guardar_perfil?: boolean;
}

export interface PerfilFiscal {
  id: string;
  cliente_id?: string;
  tipo_documento: TipoDocumentoFiscal;
  nit_ci: string;
  razon_social: string;
  email_facturacion?: string;
  es_predeterminado?: boolean;
  creado_el?: string;
}

export interface ValidacionNitResponse {
  valido: boolean;
  nit_ci: string;
  razon_social?: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'NO_ENCONTRADO';
  mensaje?: string;
}

export interface FacturaEmitida {
  id: string;
  numero_factura: number;
  cuf: string;
  cufd: string;
  fecha_emision: string;
  modalidad: 'con_factura' | 'sin_factura';
  datos_comprador: {
    tipo_documento: TipoDocumentoFiscal;
    nit_ci: string;
    razon_social: string;
    email_facturacion?: string;
  };
  sucursal: string;
  punto_venta: number;
  total: number;
  total_sujeto_iva: number;
  descuento: number;
  metodo_pago: string;
  codigo_qr: string;
  leyenda_fiscal: string;
  items: Array<{
    sku: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
}

export type CheckoutModalidad = 'domicilio' | 'retiro_sucursal';
export type CheckoutMetodoPago = 'tarjeta' | 'qr' | 'pasarela';
export type ReservaStockStatus = 'idle' | 'reservando' | 'activa' | 'expirada' | 'confirmada' | 'error';

export interface ReservaStockResponse {
  reserva_id: string;
  ttl_expira_en_segundos: number;
  expira_en_timestamp?: number;
  monto_total: number;
  metodo_pago?: string;
  status: string;
  mensaje?: string;
}

export interface CheckoutPayload {
  tipo_despacho: CheckoutModalidad;
  metodo_pago: CheckoutMetodoPago;
  sucursal_id?: string;
  direccion_entrega?: string;
  costo_envio: number;
  notas?: string;
  datos_fiscales?: DatosFiscales;
}

// -----------------------------------------------------------------------------
// BÚSQUEDA FACETADA Y SUGERENCIAS (RF-06 / US-06)
// -----------------------------------------------------------------------------
export interface FacetItem {
  id: string;
  etiqueta: string;
  total: number;
  seleccionado: boolean;
}

export interface RangoPrecioFacet {
  min: number;
  max: number;
}

export interface FacetasCatalogo {
  categorias: FacetItem[];
  marcas: FacetItem[];
  precio: RangoPrecioFacet;
  en_stock: number;
  total_general: number;
}

export interface BusquedaFacetadaResponse {
  items: Producto[];
  total_coincidencias: number;
  pagina: number;
  limite: number;
  facetas: FacetasCatalogo;
}

export interface SugerenciaItem {
  id: string;
  nombre: string;
  sku: string;
  categoria: string;
  marca?: string | null;
  precio: number;
  imagen_url?: string | null;
  stock: number;
}

export interface MarketplaceProduct {
  id: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  categoria_id?: string;
  marca?: string;
  precio: number;
  rating: number;
  stock: number;
  badge: string;
  image: string;
  galleryImages: Array<{ id: string; url: string; es_principal: boolean; orden: number }>;
  atributos?: Record<string, any>;
  variantes?: Array<{ id: string; sku: string; nombre_variante: string; atributos: Record<string, any>; precio: number }>;
}

// ============================================================================
// HISTORIA US-04 / RF-04: LISTAS DE PRECIOS DIFERENCIADAS Y TARIFAS
// ============================================================================
export interface PrecioItem {
  id: string;
  lista_precio_id: string;
  variante_id: string;
  sku?: string;
  nombre?: string;
  precio: number;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface ListaPrecio {
  id: string;
  nombre: string;
  canal: 'web' | 'pos' | 'b2b';
  tipo_cliente: 'retail' | 'corporativo_b2b';
  sucursal_id?: string | null;
  sucursal_nombre?: string | null;
  moneda: 'BOB' | 'USD';
  activo: boolean;
  total_items?: number;
  items?: PrecioItem[];
  created_at?: string;
}

export interface PrecioResolucion {
  lista_precio_id?: string | null;
  lista_nombre: string;
  variante_id: string;
  precio: number;
  moneda: string;
  canal: string;
  tipo_cliente: string;
  sucursal_id?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
}


