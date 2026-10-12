import type { ReceptionEntry, ServiceItem, ChurchService } from './models'

const keys = {
  services: 'culto-local-services',
  entries: 'culto-local-entries',
  items: 'culto-local-items',
}

function read<T>(key: string): T[] {
  const value = localStorage.getItem(key)
  if (!value) return []

  try {
    return JSON.parse(value) as T[]
  } catch (error) {
    console.error(`Não foi possível ler os dados locais (${key}).`, error)
    return []
  }
}

function write<T>(key: string, records: T[]) {
  localStorage.setItem(key, JSON.stringify(records))
  window.dispatchEvent(new CustomEvent('culto-local-update', { detail: key }))
}

export const localData = {
  getServices: () => read<ChurchService>(keys.services),
  getEntries: (serviceId: string) =>
    read<ReceptionEntry>(keys.entries).filter((entry) => entry.service_id === serviceId),
  getItems: (serviceId: string) =>
    read<ServiceItem>(keys.items)
      .filter((item) => item.service_id === serviceId)
      .sort((a, b) => a.position - b.position),
  addService: (service: ChurchService) =>
    write(keys.services, [service, ...read<ChurchService>(keys.services)]),
  addEntry: (entry: ReceptionEntry) =>
    write(keys.entries, [...read<ReceptionEntry>(keys.entries), entry]),
  updateItem: (id: string, done: boolean) =>
    write(
      keys.items,
      read<ServiceItem>(keys.items).map((item) =>
        item.id === id ? { ...item, done } : item,
      ),
    ),
  listen: (callback: (key: string) => void) => {
    const listener = (event: Event) => {
      callback((event as CustomEvent<string>).detail)
    }
    const storageListener = (event: StorageEvent) => {
      if (Object.values(keys).includes(event.key ?? '')) callback(event.key ?? '')
    }
    window.addEventListener('culto-local-update', listener)
    window.addEventListener('storage', storageListener)
    return () => {
      window.removeEventListener('culto-local-update', listener)
      window.removeEventListener('storage', storageListener)
    }
  },
}
