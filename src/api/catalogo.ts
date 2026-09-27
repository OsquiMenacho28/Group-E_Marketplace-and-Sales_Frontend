import { apiClient } from './client';

export interface StockDisponibilidad {
  sku: string;
  sucursal_id: string | null;
  stock_disponible: number;
  origen: 'cache' | 'erp';
  modo?: string | null;
}

export interface StockSucursal {
  sucursal_id: string;
  sucursal_nombre: string;
  stock_disponible: number;
}

export interface ProductoStockResumen {
  producto_id: string | null;
  sku: string;
  nombre: string;
  stock_total: number;
  sucursales: StockSucursal[];
}

export interface BusquedaStockResponse {
  query: string;
  resultados: ProductoStockResumen[];
  origen_cache: boolean;
}

export interface SyncCatalogoItem {
  id: string;
  sku: string;
  nombre: string;
  precio_referencia: number;
  estado: string;
  updated_at: string;
  accion: 'upsert' | 'baja';
}

export interface SyncCatalogoResponse {
  items: SyncCatalogoItem[];
  cursor_siguiente: string | null;
  hay_mas: boolean;
  servidor_timestamp: string;
}

/**
 * RF-07: Consulta la disponibilidad de stock en tiempo real de un SKU
 * (resuelta en el backend con caché Redis de 30s sobre RIO-INV-01).
 */
export async function consultarStock(sku: string, sucursalId?: string): Promise<StockDisponibilidad> {
  const { data } = await apiClient.get<StockDisponibilidad>(`/api/v1/catalogo/stock/${encodeURIComponent(sku)}`, {
    params: sucursalId ? { sucursal_id: sucursalId } : undefined,
  });
  return data;
}

/**
 * Consulta rápida de stock por SKU/nombre con desglose por sucursal,
 * usada por el modal de consulta rápida (atajo F3) en el POS.
 */
export async function buscarStockMultisucursal(query: string): Promise<BusquedaStockResponse> {
  const { data } = await apiClient.get<BusquedaStockResponse>('/api/v1/catalogo/productos/buscar-stock', {
    params: { q: query },
  });
  return data;
}

/**
 * RF-08 [BE]: Trae el lote de productos creados/modificados después de `since`
 * (paginado por cursor), para hidratar/actualizar la caché local del POS.
 */
export async function sincronizarCatalogoDelta(since?: string, cursor?: string): Promise<SyncCatalogoResponse> {
  const { data } = await apiClient.get<SyncCatalogoResponse>('/api/v1/catalogo/sync-catalogo', {
    params: {
      ...(since ? { since } : {}),
      ...(cursor ? { cursor } : {}),
      page_size: 50,
    },
  });
  return data;
}

/**
 * RF-08 [BE]: Abre una conexión SSE persistente al notificador de cambios de
 * catálogo. El caller es responsable de cerrar el EventSource retornado
 * (p. ej. en el `onUnmounted` del componente/store que lo usa).
 */
export function suscribirseACambiosDeCatalogo(
  onEvento: (evento: SyncCatalogoItem & { tipo: string; emitido_en: string }) => void,
  onConexion?: (conectado: boolean) => void
): EventSource {
  const baseURL = apiClient.defaults.baseURL || 'http://localhost:8000';
  const source = new EventSource(`${baseURL}/api/v1/catalogo/sync-events`);

  source.addEventListener('connected', () => onConexion?.(true));
  source.addEventListener('catalogo-actualizado', (ev: MessageEvent) => {
    try {
      onEvento(JSON.parse(ev.data));
    } catch (err) {
      console.warn('No se pudo interpretar el evento de sincronización de catálogo:', err);
    }
  });
  source.onerror = () => onConexion?.(false);

  return source;
}
