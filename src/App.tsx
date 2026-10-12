import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Church,
  CircleHelp,
  Clock3,
  Flame,
  Headphones,
  ListChecks,
  Maximize,
  Mic2,
  Music2,
  Plus,
  Radio,
  Settings2,
  ShieldCheck,
  UsersRound,
  Video,
  Volume2,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { localData } from './lib/local-data'
import {
  categories,
  type Category,
  type ChurchService,
  type ConnectionStatus,
  type ReceptionEntry,
  type Role,
  type ServiceItem,
} from './lib/models'
import { readSettings, saveSettings, type AppSettings } from './lib/settings'
import './App.css'

const roleDetails: Record<Role, { label: string; caption: string; icon: typeof UsersRound }> = {
  recepcao: { label: 'Recepção', caption: 'Receber pessoas e participações', icon: UsersRound },
  altar: { label: 'Altar', caption: 'Acompanhar o culto ao vivo', icon: Mic2 },
  som: { label: 'Som', caption: 'Preparar louvores e vídeos', icon: Headphones },
  configuracoes: { label: 'Configurações', caption: 'Ajustar conexões e acesso', icon: Settings2 },
}

const localOnlyNotice = 'Salvo neste dispositivo. Configure o Supabase para sincronizar entre aparelhos.'

function sortByPosition(items: ServiceItem[]) {
  return [...items].sort((first, second) => first.position - second.position)
}

function youtubeEmbedUrl(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : ''
}

function formatServiceDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(readSettings)
  const client = useMemo<SupabaseClient | null>(() => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return null
    try {
      return createClient(settings.supabaseUrl, settings.supabaseAnonKey)
    } catch (error) {
      console.error('Configuração inválida do Supabase.', error)
      return null
    }
  }, [settings.supabaseUrl, settings.supabaseAnonKey])
  const [role, setRole] = useState<Role>('recepcao')
  const [services, setServices] = useState<ChurchService[]>([])
  const [activeId, setActiveId] = useState(() => localStorage.getItem('culto-active-id') ?? '')
  const [items, setItems] = useState<ServiceItem[]>([])
  const [entries, setEntries] = useState<ReceptionEntry[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [showServiceForm, setShowServiceForm] = useState(false)
  const activeService = services.find((service) => service.id === activeId) ?? null

  const refreshServices = useCallback(async () => {
    let nextServices: ChurchService[]
    if (!client) {
      nextServices = await Promise.resolve(localData.getServices())
    } else {
      const { data, error } = await client
        .from('services')
        .select('id,title,scheduled_at')
        .order('scheduled_at', { ascending: false })
      if (error) {
        toast.error(`Não foi possível carregar os cultos: ${error.message}`)
        return
      }
      nextServices = (data ?? []) as ChurchService[]
    }

    nextServices.sort(
      (first, second) =>
        new Date(second.scheduled_at).getTime() - new Date(first.scheduled_at).getTime(),
    )
    setServices(nextServices)
    setActiveId((current) => {
      const validId = current && nextServices.some((service) => service.id === current)
      const nextId = validId ? current : nextServices[0]?.id ?? ''
      if (nextId) localStorage.setItem('culto-active-id', nextId)
      return nextId
    })
  }, [client])

  useEffect(() => {
    void refreshServices()
  }, [refreshServices])

  useEffect(() => {
    if (!client) return

    const channel = client.channel('culto-app-status').subscribe((channelStatus) => {
      if (channelStatus === 'SUBSCRIBED') setStatus('connected')
      else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
        setStatus('offline')
      } else {
        setStatus('connecting')
      }
    })

    return () => {
      void client.removeChannel(channel)
    }
  }, [client])

  const reloadActiveData = useCallback(async () => {
    if (!activeId) return
    if (!client) {
      const localSnapshot = await Promise.resolve({
        items: localData.getItems(activeId),
        entries: localData.getEntries(activeId),
      })
      setItems(localSnapshot.items)
      setEntries(localSnapshot.entries)
      return
    }

    const [itemsResult, entriesResult] = await Promise.all([
      client
        .from('service_items')
        .select('id,service_id,category,title,detail,youtube_url,position,done,created_at')
        .eq('service_id', activeId)
        .order('position', { ascending: true }),
      client
        .from('reception_entries')
        .select('id,service_id,category,name,detail,youtube_url,performer,accompaniment,created_at')
        .eq('service_id', activeId)
        .order('created_at', { ascending: false }),
    ])
    if (itemsResult.error) toast.error(`Não foi possível carregar a programação: ${itemsResult.error.message}`)
    else setItems((itemsResult.data ?? []) as ServiceItem[])
    if (entriesResult.error) toast.error(`Não foi possível carregar os recebimentos: ${entriesResult.error.message}`)
    else setEntries((entriesResult.data ?? []) as ReceptionEntry[])
  }, [activeId, client])

  useEffect(() => {
    void reloadActiveData()
    if (!activeId || client) return

    return localData.listen((key) => {
      if (key === 'culto-local-items' || key === 'culto-local-entries') {
        void reloadActiveData()
      } else if (key === 'culto-local-services') {
        void refreshServices()
      }
    })
  }, [activeId, client, refreshServices, reloadActiveData])

  useEffect(() => {
    if (!activeId) return
    localStorage.setItem('culto-active-id', activeId)
  }, [activeId])

  useEffect(() => {
    if (!client || !activeId) return
    const channel = client
      .channel(`culto-${activeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_items', filter: `service_id=eq.${activeId}` },
        () => void reloadActiveData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reception_entries', filter: `service_id=eq.${activeId}` },
        () => void reloadActiveData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => void refreshServices())
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [activeId, client, refreshServices, reloadActiveData])

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const title = String(form.get('title') ?? '').trim()
    const dateInput = String(form.get('scheduled_at') ?? '')
    if (!title || !dateInput) {
      toast.error('Informe o título e a data do culto.')
      return
    }
    const scheduledAt = new Date(dateInput).toISOString()
    let service: ChurchService

    if (!client) {
      service = { id: crypto.randomUUID(), title, scheduled_at: scheduledAt }
      localData.addService(service)
      toast.success('Culto criado.', { description: localOnlyNotice })
    } else {
      const { data, error } = await client
        .from('services')
        .insert({ title, scheduled_at: scheduledAt })
        .select('id,title,scheduled_at')
        .single()
      if (error) {
        toast.error(`Não foi possível criar o culto: ${error.message}`)
        return
      }
      service = data as ChurchService
      toast.success('Culto criado e sincronizado.')
    }

    await refreshServices()
    setActiveId(service.id)
    setShowServiceForm(false)
    formElement.reset()
  }

  async function addReceptionEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (!activeId) {
      toast.error('Crie ou selecione um culto antes de salvar.')
      return
    }
    const form = new FormData(formElement)
    const category = String(form.get('category')) as Category
    const performer = String(form.get('performer') ?? '').trim()
    const accompanimentValue = String(form.get('accompaniment') ?? '')
    const youtubeUrl = String(form.get('youtube_url') ?? '').trim()
    if (category === 'Louvor' && !performer) {
      toast.error('Informe quem vai cantar o louvor.')
      return
    }
    if (category === 'Louvor' && !['band', 'youtube'].includes(accompanimentValue)) {
      toast.error('Selecione se o louvor será acompanhado por banda ou playback.')
      return
    }
    if (category === 'Louvor' && accompanimentValue === 'youtube' && !youtubeEmbedUrl(youtubeUrl)) {
      toast.error('Pesquise e selecione um playback do YouTube.')
      return
    }

    const entry: ReceptionEntry = {
      id: crypto.randomUUID(),
      service_id: activeId,
      category,
      name: String(form.get('name') ?? '').trim(),
      detail: String(form.get('detail') ?? '').trim(),
      youtube_url: youtubeUrl,
      performer,
      accompaniment: category === 'Louvor'
        ? accompanimentValue === 'youtube' ? 'youtube' : 'band'
        : null,
      created_at: new Date().toISOString(),
    }
    if (!entry.name) {
      toast.error('Informe o nome ou título.')
      return
    }

    if (!client) {
      localData.addEntry(entry)
      setEntries((current) => [entry, ...current])
      toast.success('Adicionado ✓', { description: localOnlyNotice })
    } else {
      const { id: _id, created_at: _createdAt, ...payload } = entry
      const { error } = await client.from('reception_entries').insert(payload)
      if (error) {
        toast.error(`Não foi possível salvar: ${error.message}`)
        return
      }
      await reloadActiveData()
      toast.success('Adicionado ✓')
    }
    formElement.reset()
  }

  async function toggleItem(item: ServiceItem, done = !item.done) {
    if (!client) {
      localData.updateItem(item.id, done)
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, done } : entry)))
      return
    }
    const { error } = await client.from('service_items').update({ done }).eq('id', item.id)
    if (error) {
      toast.error(`Não foi possível atualizar o item: ${error.message}`)
      return
    }
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, done } : entry)))
  }

  function saveAppSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const url = String(form.get('supabaseUrl') ?? '').trim().replace(/\/$/, '')
    const anonKey = String(form.get('supabaseAnonKey') ?? '').trim()
    if (Boolean(url) !== Boolean(anonKey)) {
      toast.error('Preencha a URL e a chave anônima do Supabase, ou deixe os dois campos vazios.')
      return
    }
    if (url) {
      try {
        const parsedUrl = new URL(url)
        if (!['https:', 'http:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol')
      } catch {
        toast.error('Informe uma URL válida do Supabase.')
        return
      }
    }
    const nextSettings = { supabaseUrl: url, supabaseAnonKey: anonKey }
    saveSettings(nextSettings)
    setStatus('connecting')
    setSettings(nextSettings)
    toast.success('Configurações salvas.')
  }

  const orderedItems = sortByPosition(items)
  const displayStatus = client ? status : 'offline'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="AD GASPAR, início" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark"><img src={`${import.meta.env.BASE_URL}logo-igreja.jfif`} alt="" /></span>
          <span><strong>AD GASPAR</strong><small>gestão do culto</small></span>
        </a>
        <div className="nav-section-label">ESPAÇO DE TRABALHO</div>
        <nav className="role-nav" aria-label="Áreas do app">
          {(Object.keys(roleDetails) as Role[]).map((key) => {
            const { label, caption, icon: Icon } = roleDetails[key]
            return (
              <button className={`nav-link ${role === key ? 'active' : ''}`} key={key} aria-label={label} title={label} onClick={() => setRole(key)}>
                <span className="nav-icon"><Icon size={18} /></span>
                <span className="nav-label">{label}<small>{caption}</small></span>
                {role === key && <ChevronRight className="nav-chevron" size={16} />}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon"><CircleHelp size={17} /></span>
            <p><strong>Um só culto, uma só equipe.</strong><br />Tudo em ordem para servir melhor.</p>
          </div>
          <span className="version-label">AD GASPAR · GESTÃO DO CULTO</span>
        </div>
      </aside>

      <div className="main-column">
        <div className="site-header">
          <div className="campaign-banner" aria-label="Evangelização — a chama não pode apagar">
            <Flame className="campaign-flame" size={22} aria-hidden="true" />
            <span className="campaign-title">EVANGELIZAÇÃO</span>
            <span className="campaign-subtitle">A CHAMA NÃO PODE APAGAR</span>
          </div>
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}logo-igreja.jfif`} alt="" /></span><strong>AD GASPAR</strong></div>
          <div className="topbar-context">
            <span className={`live-indicator ${displayStatus}`}><i />{status === 'connected' ? 'Ao vivo' : client ? status === 'connecting' ? 'Conectando' : 'Sem conexão' : 'Modo local'}</span>
            {activeService && <><span className="topbar-divider" /><CalendarDays size={15} /><span className="active-service-name">{activeService.title}</span></>}
          </div>
          <div className="topbar-actions">
            <button className="button button-secondary button-small" onClick={() => setShowServiceForm((show) => !show)}>
              <Plus size={15} /> <span>Novo culto</span>
            </button>
            {activeService && (
              <label className="service-picker">
                <span className="sr-only">Selecionar culto</span>
                <select value={activeId} onChange={(event) => setActiveId(event.target.value)}>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.title} · {formatServiceDate(service.scheduled_at)}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
            )}
          </div>
        </header>
        </div>

        {showServiceForm && (
          <div className="service-create-panel">
            <div><span className="eyebrow">NOVO ENCONTRO</span><h2>Prepare um culto</h2></div>
            <form className="service-create-form" onSubmit={createService}>
              <label>Título<input name="title" placeholder="Ex.: Culto de celebração" required autoFocus /></label>
              <label>Data e hora<input name="scheduled_at" type="datetime-local" required /></label>
              <button className="button button-primary" type="submit"><Plus size={16} /> Criar culto</button>
            </form>
          </div>
        )}

        {!client && (
          <div className="local-banner"><Radio size={15} /><span><strong>Modo local</strong> — os dados ficam neste aparelho. Configure o Supabase em Configurações para sincronizar com a equipe.</span><button onClick={() => setRole('configuracoes')}>Configurar</button></div>
        )}

        <main className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{role === 'configuracoes' ? 'PREFERÊNCIAS' : 'EQUIPE DO CULTO'}</div>
              <h1>{role === 'configuracoes' ? 'Configurações' : roleDetails[role].label}</h1>
              <p>{role === 'configuracoes' ? 'Conecte os aparelhos da equipe ao mesmo culto.' : roleDetails[role].caption + (activeService ? ` · ${activeService.title}` : '')}</p>
            </div>
            {activeService && role !== 'configuracoes' && <div className="date-chip"><CalendarDays size={16} /><span>{formatServiceDate(activeService.scheduled_at)}</span></div>}
          </div>

          {role === 'configuracoes' ? null : !activeService ? (
            <section className="empty-state card">
              <span className="empty-icon"><CalendarDays size={24} /></span>
              <h2>Vamos preparar o primeiro culto?</h2>
              <p>Crie um encontro para a recepção registrar participações e a equipe acompanhar o culto.</p>
              <button className="button button-primary" onClick={() => setShowServiceForm(true)}><Plus size={16} /> Criar culto</button>
            </section>
          ) : (
            <>
              {role === 'recepcao' && <ReceptionPage entries={entries} onSubmit={addReceptionEntry} client={client} />}
              {role === 'altar' && <AltarPage items={orderedItems} onToggle={(item) => void toggleItem(item)} />}
              {role === 'som' && <SoundPage items={orderedItems} />}
            </>
          )}
          {role === 'configuracoes' && <SettingsPage settings={settings} onSubmit={saveAppSettings} client={client} />}
        </main>
        <footer className="app-footer"><span>Feito para servir com excelência.</span><span>AD GASPAR <span className="footer-dot">·</span> {client ? 'Sincronização Supabase' : 'Armazenamento local'}</span></footer>
      </div>

      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}

type YouTubeSearchResult = {
  id: { videoId: string }
  snippet: {
    title: string
    channelTitle: string
    thumbnails?: { medium?: { url: string }; default?: { url: string } }
  }
}

function ReceptionPage({ entries, onSubmit, client }: { entries: ReceptionEntry[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void; client: SupabaseClient | null }) {
  const [category, setCategory] = useState<Category>('Louvor')
  const [accompaniment, setAccompaniment] = useState<'band' | 'youtube'>('band')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([])
  const [selectedTrack, setSelectedTrack] = useState<YouTubeSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  async function searchYouTube() {
    const query = searchQuery.trim()
    if (!client) {
      toast.error('Conecte o Supabase para pesquisar playbacks.')
      return
    }
    if (!query) {
      toast.error('Digite o nome do louvor para pesquisar.')
      return
    }

    setSearching(true)
    try {
      const { data, error } = await client.functions.invoke<{ items: YouTubeSearchResult[] }>(
        'search-youtube',
        { body: { query } },
      )
      if (error) throw error
      if (!data) throw new Error('A busca não retornou resultados válidos.')
      setSearchResults(data.items)
      setSelectedTrack(null)
      if (!data.items.length) toast.info('Nenhum playback encontrado. Tente outro termo.')
    } catch (error) {
      console.error('Falha ao pesquisar playbacks no YouTube.', error)
      toast.error(`Não foi possível pesquisar no YouTube: ${error instanceof Error ? error.message : 'erro desconhecido'}`)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="two-column-layout">
      <section className="card form-card">
        <div className="card-heading"><div><span className="eyebrow">NOVO RECEBIMENTO</span><h2>Quem quer participar?</h2></div><span className="heading-icon"><UsersRound size={18} /></span></div>
        <form className="stack-form" onSubmit={onSubmit}>
          <label>Tipo de participação
            <select
              name="category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as Category)
                setSearchResults([])
                setSelectedTrack(null)
              }}
            >
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {category === 'Louvor' ? <>
            <label>Nome do louvor
              <input name="name" placeholder="Nome do louvor" required />
            </label>
            <label>Quem vai cantar
              <input name="performer" placeholder="Nome de quem vai cantar" required />
            </label>
            <label>Acompanhamento
              <select
                name="accompaniment"
                value={accompaniment}
                onChange={(event) => {
                  setAccompaniment(event.target.value as 'band' | 'youtube')
                  setSearchResults([])
                  setSelectedTrack(null)
                }}
              >
                <option value="band">Com banda</option>
                <option value="youtube">Playback do YouTube</option>
              </select>
            </label>
            {accompaniment === 'youtube' && <div className="youtube-search">
              <label htmlFor="youtube-playback-search">Pesquisar playback no YouTube</label>
              <div className="youtube-search-controls">
                <input
                  id="youtube-playback-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void searchYouTube()
                    }
                  }}
                  placeholder="Digite o nome do louvor"
                />
                <button className="button button-secondary button-small" type="button" disabled={searching} onClick={() => void searchYouTube()}>
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              {!client && <small className="youtube-search-help">Conecte o Supabase para habilitar a busca.</small>}
              {searchResults.length > 0 && <ul className="youtube-results" aria-label="Resultados de playback">
                {searchResults.map((result) => (
                  <li key={result.id.videoId}>
                    <button
                      className={`youtube-result ${selectedTrack?.id.videoId === result.id.videoId ? 'selected' : ''}`}
                      type="button"
                      onClick={() => setSelectedTrack(result)}
                    >
                      {result.snippet.thumbnails?.default?.url && <img src={result.snippet.thumbnails.default.url} alt="" />}
                      <span><strong>{result.snippet.title}</strong><small>{result.snippet.channelTitle}</small></span>
                      {selectedTrack?.id.videoId === result.id.videoId && <Check size={16} />}
                    </button>
                  </li>
                ))}
              </ul>}
              {selectedTrack && <>
                <input type="hidden" name="youtube_url" value={`https://www.youtube.com/watch?v=${selectedTrack.id.videoId}`} />
                <div className="youtube-selected">Playback selecionado: <strong>{selectedTrack.snippet.title}</strong></div>
              </>}
            </div>}
          </> : category === 'Visitante' ? (
            <label>Nome do visitante
              <input name="name" placeholder="Nome completo do visitante" required />
            </label>
          ) : (
            <label>Nome ou título
              <input name="name" placeholder="Nome da pessoa ou título" required />
            </label>
          )}
          <label>Detalhes <span className="optional">OPCIONAL</span>
            <textarea name="detail" placeholder="Uma observação para a equipe..." rows={3} />
          </label>
          <button className="button button-primary button-full" type="submit"><Plus size={16} /> Adicionar à lista</button>
        </form>
      </section>
      <section className="card list-card">
        <div className="card-heading"><div><span className="eyebrow">ENTRADAS DESTE CULTO</span><h2>Recebidos <span className="count-badge">{entries.length}</span></h2></div><span className="heading-icon"><Bell size={18} /></span></div>
        {entries.length === 0 ? <EmptyList icon={<UsersRound size={21} />} text="As participações recebidas aparecerão aqui." /> : (
          <ul className="entry-list">{entries.map((entry) => (
            <li className="entry-row" key={entry.id}>
              <CategoryMark category={entry.category} />
              <div className="entry-info">
                <strong>{entry.name}</strong>
                <span>{entry.category === 'Louvor'
                  ? [entry.performer, entry.accompaniment === 'youtube'
                    ? 'Playback do YouTube'
                    : entry.accompaniment === 'band' ? 'Com banda' : 'Acompanhamento não informado'].filter(Boolean).join(' · ')
                  : [entry.category, entry.detail].filter(Boolean).join(' · ')}</span>
              </div>
              {entry.youtube_url && <a className="icon-button" href={entry.youtube_url} target="_blank" rel="noreferrer" aria-label="Abrir vídeo"><Video size={16} /></a>}
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  )
}

function AltarPage({ items, onToggle }: { items: ServiceItem[]; onToggle: (item: ServiceItem) => void }) {
  const pending = items.filter((item) => !item.done)
  const current = pending[0]
  const next = pending[1]
  return (
    <div className="altar-layout">
      <section className="now-card">
        <div className="now-card-top"><span className="live-indicator connected"><i /> AGORA</span><span className="program-position">{items.length - pending.length + (current ? 1 : 0)} / {items.length}</span></div>
        {current ? <>
          <div className="now-category"><CategoryMark category={current.category} /> {current.category}</div>
          <h2>{current.title}</h2>
          {current.detail && <p>{current.detail}</p>}
          <button className="button button-light" onClick={() => onToggle(current)}><CheckCircle2 size={17} /> Marcar como feito</button>
        </> : <div className="finished-state"><CheckCircle2 size={32} /><h2>Programação concluída</h2><p>Todos os itens deste culto foram realizados.</p></div>}
      </section>
      <section className="card next-card">
        <div className="next-card-label"><span className="eyebrow">EM SEGUIDA</span><Clock3 size={16} /></div>
        {next ? <><div className="next-category">{next.category}</div><h3>{next.title}</h3>{next.detail && <p>{next.detail}</p>}</> : <div className="no-next">Nenhum próximo item na programação.</div>}
      </section>
      <section className="card altar-queue">
        <div className="card-heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h2>Ordem completa <span className="count-badge">{items.length}</span></h2></div><span className="heading-icon"><ListChecks size={18} /></span></div>
        {items.length === 0 ? <EmptyList icon={<Mic2 size={21} />} text="A programação do culto aparecerá aqui quando for adicionada ao sistema." /> : <ol className="program-list altar-program-list">{items.map((item, index) => (
          <li className={`program-row ${item.done ? 'done' : ''} ${item.id === current?.id ? 'is-current' : ''}`} key={item.id}>
            <button className="program-check" aria-label={item.done ? 'Marcar como pendente' : 'Marcar como feito'} onClick={() => onToggle(item)}>{item.done ? <Check size={15} /> : <span>{String(index + 1).padStart(2, '0')}</span>}</button>
            <div className="program-info"><div><span className="category-label">{item.category}</span></div><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</div>
            {item.id === current?.id && <span className="now-tag">AGORA</span>}
          </li>
        ))}</ol>}
      </section>
    </div>
  )
}

function SoundPage({ items }: { items: ServiceItem[] }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const songs = items.filter((item) => item.category === 'Louvor')
  const current = songs.find((item) => !item.done)
  const nextSong = songs.filter((item) => !item.done)[1]
  const embedUrl = current ? youtubeEmbedUrl(current.youtube_url) : ''

  async function fullscreen() {
    if (!iframeRef.current) return
    try {
      await iframeRef.current.requestFullscreen()
    } catch (error) {
      toast.error('Não foi possível abrir o vídeo em tela cheia.')
      console.error('Falha ao ativar tela cheia para o player.', error)
    }
  }

  return (
    <div className="sound-layout">
      <section className="card sound-player-card">
        <div className="card-heading"><div><span className="eyebrow">LOUVOR ATUAL</span><h2>{current?.title ?? 'Nenhum louvor pendente'}</h2></div><span className="heading-icon"><Volume2 size={18} /></span></div>
        {current ? embedUrl ? (
          <div className="video-frame-wrap"><iframe ref={iframeRef} src={embedUrl} title={`Vídeo de ${current.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /><button className="fullscreen-button" onClick={() => void fullscreen()}><Maximize size={14} /> Tela cheia</button></div>
        ) : <div className="no-video"><Music2 size={25} /><strong>Vídeo não informado</strong><span>O louvor está na programação, mas ainda não tem um link válido do YouTube.</span></div> : <EmptyList icon={<Music2 size={22} />} text="Quando houver um louvor na programação, ele será exibido aqui." />}
        {current?.youtube_url && <a className="button button-secondary open-video-button" href={current.youtube_url} target="_blank" rel="noreferrer"><Video size={16} /> Abrir no YouTube</a>}
      </section>
      <aside className="card sound-queue">
        <div className="card-heading"><div><span className="eyebrow">PREPARAÇÃO</span><h2>Fila de louvores <span className="count-badge">{songs.length}</span></h2></div><span className="heading-icon"><Headphones size={18} /></span></div>
        {songs.length === 0 ? <EmptyList icon={<Music2 size={20} />} text="Nenhum louvor adicionado a este culto." /> : <div className="song-list">{songs.map((song, index) => (
          <div className={`song-row ${song.done ? 'done' : ''} ${song.id === current?.id ? 'is-current' : ''}`} key={song.id}>
            <span className="song-index">{song.done ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span><div><strong>{song.title}</strong><small>{song.done ? 'Concluído' : song.id === current?.id ? 'Tocando agora' : song.id === nextSong?.id ? 'A seguir' : 'Na programação'}</small></div>
            {song.youtube_url && <a href={song.youtube_url} target="_blank" rel="noreferrer" aria-label={`Abrir ${song.title} no YouTube`}><Video size={15} /></a>}
          </div>
        ))}</div>}
        <p className="sound-help"><Volume2 size={14} /> A fila é atualizada em tempo real conforme a programação do culto muda.</p>
      </aside>
    </div>
  )
}

function SettingsPage({ settings, onSubmit, client }: { settings: AppSettings; onSubmit: (event: FormEvent<HTMLFormElement>) => void; client: SupabaseClient | null }) {
  return (
    <form className="settings-layout" onSubmit={onSubmit}>
      <section className="card settings-card">
        <div className="card-heading"><div><span className="eyebrow">SINCRONIZAÇÃO</span><h2>Conectar ao Supabase</h2></div><span className="heading-icon"><Radio size={18} /></span></div>
        <p className="card-intro">Use a URL do projeto e a chave pública (anon/publishable) para compartilhar cultos entre os aparelhos da equipe.</p>
        <div className="stack-form">
          <label>Project URL<input type="url" name="supabaseUrl" defaultValue={settings.supabaseUrl} placeholder="https://seu-projeto.supabase.co" /></label>
          <label>Chave pública (anon)<input type="password" name="supabaseAnonKey" defaultValue={settings.supabaseAnonKey} placeholder="eyJhbGciOi..." autoComplete="off" /></label>
          <div className={`connection-result ${client ? 'is-configured' : ''}`}><span className="status-dot" />{client ? 'Projeto configurado. Verifique o indicador “Ao vivo” no cabeçalho.' : 'Sem conexão configurada. O app está usando armazenamento local.'}</div>
        </div>
      </section>
      <section className="notice-card"><ShieldCheck size={17} /><p><strong>Importante para publicar.</strong> O app não tem login real nesta versão. A chave anon do Supabase é pública por design; as regras do banco determinam quem consegue ler ou alterar os dados. Use apenas para uma equipe confiável e não coloque a chave service_role no navegador.</p></section>
      <button className="button button-primary settings-save" type="submit"><Check size={16} /> Salvar configurações</button>
    </form>
  )
}

function CategoryMark({ category }: { category: Category }) {
  const Icon = category === 'Louvor' ? Music2 : category === 'Visitante' ? UsersRound : category === 'Aviso' ? Bell : category === 'Pregação' ? Church : Mic2
  return <span className={`category-mark category-${category.toLowerCase().replaceAll('ã', 'a').replaceAll('ç', 'c').replaceAll('ã', 'a')}`}><Icon size={15} /></span>
}

function EmptyList({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="empty-list"><span>{icon}</span><p>{text}</p></div>
}

export default App
