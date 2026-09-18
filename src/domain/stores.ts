// Looking an item up at the store you actually shop at. The links are plain web searches; on a
// phone the store's app opens them instead of the browser when it is installed.
export type StoreId = 'walmart' | 'target' | 'kroger' | 'aldi' | 'instacart' | 'none';

export interface Store {
  id: StoreId;
  label: string;
  search?: (q: string) => string;
}

export const STORES: Store[] = [
  { id: 'walmart', label: 'Walmart', search: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}` },
  { id: 'target', label: 'Target', search: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}` },
  { id: 'kroger', label: 'Kroger', search: (q) => `https://www.kroger.com/search?query=${encodeURIComponent(q)}` },
  { id: 'aldi', label: 'ALDI', search: (q) => `https://www.aldi.us/results?q=${encodeURIComponent(q)}` },
  { id: 'instacart', label: 'Instacart', search: (q) => `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}` },
  { id: 'none', label: 'No store links' },
];

export function storeById(id: StoreId | undefined): Store | undefined {
  return STORES.find((s) => s.id === (id ?? 'walmart'));
}

/** The store's search page for an item, or undefined when store links are off. */
export function storeSearchUrl(id: StoreId | undefined, item: string): string | undefined {
  const store = storeById(id);
  const q = item.trim();
  return store?.search && q ? store.search(q) : undefined;
}
