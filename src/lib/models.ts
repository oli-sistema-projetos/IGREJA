export const categories = [
  'Louvor',
  'Testemunho',
  'Pregação',
  'Aviso',
  'Visitante',
  'Outro',
] as const

export type Category = (typeof categories)[number]
export type Role = 'recepcao' | 'altar' | 'som' | 'configuracoes'
export type ConnectionStatus = 'connected' | 'connecting' | 'offline'

export type ChurchService = {
  id: string
  title: string
  scheduled_at: string
}

export type ReceptionEntry = {
  id: string
  service_id: string
  category: Category
  name: string
  detail: string
  youtube_url: string
  performer: string
  accompaniment: 'band' | 'youtube' | null
  created_at: string
}

export type ServiceItem = {
  id: string
  service_id: string
  category: Category
  title: string
  detail: string
  youtube_url: string
  position: number
  done: boolean
  created_at: string
}
