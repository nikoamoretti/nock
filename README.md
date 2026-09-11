# Nock

Local-first issue tracker. Keyboard-first, Linear-inspired, **not Folium** and **not affiliated with Linear**.

Issues live in an in-memory object pool, persisted to IndexedDB. The UI updates before disk I/O finishes — same idea as Linear’s client, implemented clean-room. See [docs/LINEAR.md](docs/LINEAR.md).

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Shortcuts

- `C` new issue
- `⌘K` command menu
- `J` / `K` move selection
- `T` status · `A` assignee · `P` priority
- `G` then `I` / `M` / `A` / `B` / `P` / `C` to jump views

## Test

```bash
npm test
```
