## Entendi a lógica do app

Quatro perfis trabalham em tempo real sobre um mesmo **Culto** (data + título):

- **Recepção** cadastra quem quer cantar, visitantes e avisos.
- **Pastor** monta a ordem do culto. Para cada tipo (Louvor, Testemunho, etc.) ele vê via checkbox os nomes recebidos da recepção e marca quem entra. Também cria/seleciona o culto.
- **Altar** mostra a ordem ao vivo e permite marcar "feito" → vai destacando o item **Agora**.
- **Som** vê os louvores, com player do YouTube embutido e botão para abrir o vídeo.

Sincronização via Supabase Realtime em `services`, `service_items`, `reception_entries`.

## O que ainda dá para profissionalizar

Foco em ganhos reais de uso durante o culto, sem virar outro app.

### 1. Altar — destacar "Agora" e "Próximo"
Hoje só mostra **Agora**. Adicionar card menor logo abaixo com **Próximo item** (próximo `!done`) — quem está no altar vê a transição vindo.

### 2. Pastor — ações rápidas e contadores
- Badge contadora em cada botão de tipo (`Louvor 3`, `Pregação 1`…) para enxergar o equilíbrio do culto.
- Botão "Avançar" no topo do programa (marca o item atual como feito e rola para o próximo) — o pastor conduz sem caçar checkbox.
- Botão "Excluir culto" no seletor (com confirmação) — hoje só dá pra criar, ficam cultos antigos acumulando.

### 3. Recepção — confirmação visual
Toast verde "Adicionado ✓" depois de salvar (hoje o formulário só limpa em silêncio — operador fica em dúvida).

### 4. Som — modo "TV"
Botão `⛶ Tela cheia` no card do louvor atual: oculta cabeçalho, expande o vídeo ao máximo. Útil quando o técnico projeta numa TV.

### 5. Senha do pastor configurável
Hoje a senha `12345` está fixa no código. Mover para a tela de Configurações (salva em `localStorage` junto das outras chaves), com fallback para `12345` se vazia. Continua client-side (o app não tem login real), mas deixa de ser pública no repositório.

### 6. Visual mais moderno e consistente
- Substituir o cabeçalho atual por um header com **ponto verde "ao vivo"** quando o realtime está conectado — feedback de status que falta hoje.
- Trocar os botões/inputs soltos pelos componentes shadcn já instalados (`Button`, `Input`, `Tabs`, `Card`) — ganha foco, hover, acessibilidade e o app fica visualmente coeso.
- Tela inicial: cards de papel com ícone (lucide-react) ao invés de blocos coloridos chapados.

### 7. Persistência do culto ativo entre dispositivos
Hoje cada aparelho lembra o culto ativo só no próprio `localStorage`. Se o pastor cria um culto novo, a recepção continua no antigo. Solução leve: marcar o culto mais recente (maior `scheduled_at`) como padrão quando o `activeId` salvo não existe mais, e ordenar o seletor por data desc (já é) deixando o do dia em destaque.

### Fora do escopo desta rodada
Login real / multi-igreja, drag-and-drop com mouse, histórico de durações por item, exportar PDF do culto. Posso fazer depois se quiser.

## Detalhes técnicos

- **Status realtime**: hook `useRealtimeStatus()` que escuta `supabase.channel('status').subscribe((s) => …)` e expõe `'connected' | 'connecting' | 'offline'`. Consumido pelo `AppHeader`.
- **Próximo item (Altar)**: `items.filter(i => !i.done)[1]` depois de garantir ordenação por `position`.
- **Avançar (Pastor)**: marca `done = true` no primeiro `!done` e dá `scrollIntoView` no novo atual.
- **Excluir culto**: `supabase.from('services').delete().eq('id', id)` + `ON DELETE` em `service_items` e `reception_entries` precisa de migration (`ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY … ON DELETE CASCADE`).
- **Toasts**: `sonner` já está no projeto via `src/components/ui/sonner.tsx`; só montar `<Toaster />` no `__root.tsx`.
- **Senha do pastor**: estender `AppSettings` em `src/lib/settings.ts` com `pastorPassword?: string`, ler na tela `pastor.tsx`.
- **Tela cheia (Som)**: `iframeRef.current?.requestFullscreen()` no botão.

Quer que eu siga com tudo isso ou prefere selecionar só alguns itens?
