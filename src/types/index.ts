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
}

export interface ItemCarrito {
  variante_id: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
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
  mensaje?: string;
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
  cliente_id: string;
  variante_id: string;
  created_at: string;
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
