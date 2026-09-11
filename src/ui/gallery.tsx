import { useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ContextMenu,
  Dialog,
  DropdownMenu,
  IconButton,
  Kbd,
  Popover,
  Radio,
  RadioGroup,
  ScrollArea,
  Separator,
  Sheet,
  Skeleton,
  Spinner,
  Tabs,
  Textarea,
  TextField,
  ToastProvider,
  Tooltip,
  useTheme,
  useToast,
} from './index'

export function UiGallery() {
  return (
    <ToastProvider>
      <GalleryBody />
    </ToastProvider>
  )
}

function GalleryBody() {
  const { theme, setTheme } = useTheme()
  const { push } = useToast()
  const [dialog, setDialog] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [popover, setPopover] = useState(false)
  const [tab, setTab] = useState('one')
  const [radio, setRadio] = useState('list')
  const [checked, setChecked] = useState(true)

  return (
    <div className="min-h-full bg-app p-6 text-fg">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-[18px] font-medium">Nock primitives</h1>
            <p className="text-[12px] text-secondary">
              Design-system gallery. Feature pages are unchanged.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={theme === 'dark' ? 'primary' : 'ghost'}
              onClick={() => setTheme('dark')}
            >
              Dark
            </Button>
            <Button
              variant={theme === 'light' ? 'primary' : 'ghost'}
              onClick={() => setTheme('light')}
            >
              Light
            </Button>
          </div>
        </header>

        <section className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button>Ghost</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Close">
            <span aria-hidden="true">×</span>
          </IconButton>
          <Badge>Neutral</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <Kbd>⌘K</Kbd>
          <Avatar name="You" initials="YO" />
          <Spinner />
        </section>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Title" placeholder="Issue title" />
          <TextField label="Broken field" error="Title is required" />
          <Textarea label="Description" placeholder="Add description…" />
          <div className="flex flex-col gap-2">
            <Checkbox
              label="Subscribe"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <RadioGroup
              name="layout"
              label="Layout"
              value={radio}
              onChange={setRadio}
            >
              <Radio value="list" label="List" />
              <Radio value="board" label="Board" />
            </RadioGroup>
          </div>
        </div>

        <Tabs
          label="Example tabs"
          value={tab}
          onValueChange={setTab}
          items={[
            { id: 'one', label: 'One', panel: 'First panel' },
            { id: 'two', label: 'Two', panel: 'Second panel' },
          ]}
        />

        <section className="flex flex-wrap gap-2">
          <Tooltip content="Create issue">
            <Button>Hover me</Button>
          </Tooltip>
          <Popover
            open={popover}
            onOpenChange={setPopover}
            label="Display options"
            trigger={<Button>Popover</Button>}
          >
            <Button className="w-full justify-start" onClick={() => setPopover(false)}>
              Compact
            </Button>
          </Popover>
          <DropdownMenu
            label="Status"
            items={[
              { id: 'todo', label: 'Todo', onSelect: () => undefined },
              { id: 'done', label: 'Done', onSelect: () => undefined },
            ]}
          />
          <ContextMenu
            items={[
              { id: 'copy', label: 'Copy', onSelect: () => undefined },
              { id: 'delete', label: 'Delete', onSelect: () => undefined },
            ]}
          >
            <Button>Right-click or Shift+F10</Button>
          </ContextMenu>
          <Button onClick={() => setDialog(true)}>Dialog</Button>
          <Button onClick={() => setSheet(true)}>Sheet</Button>
          <Button onClick={() => push({ title: 'Saved locally', tone: 'success' })}>
            Toast
          </Button>
        </section>

        <ScrollArea className="h-[88px] rounded-md border border-line p-2">
          <div className="text-[12px] text-secondary">
            Scrollable region using tokenized scrollbars.
            <br />
            Row height token is 34px. Controls are 28px and 32px.
            <br />
            More lines to overflow.
            <br />
            More lines to overflow.
          </div>
        </ScrollArea>
        <Skeleton className="h-[34px] w-full" />
      </div>

      <Dialog open={dialog} onClose={() => setDialog(false)} title="Confirm">
        Close with Escape or the Close button.
      </Dialog>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Detail">
        Side panel. Same command-close behavior as dialogs.
      </Sheet>
    </div>
  )
}
