import { useMemo, useState } from 'react'
import { Button, Input, Textarea, Typography } from '@maxhub/max-ui'
import { AppHeader, Screen, ScreenBody, ScreenScroll } from '@/components/AppShell'
import { Sheet } from '@/components/Sheet'
import { IconAlert, IconChevronDown, IconPlus, IconTrash } from '@/components/icons'
import { api } from '@/api/client'
import { ApiError } from '@/api/contract'
import { DOMAINS, componentsOf, getComponent } from '@/sim'
import { autoColumn, manualColumn, type JournalColumn } from '@/domain/scheme'
import { useStand, nextManualColumnKey } from '@/store/stand'
import { useSession } from '@/store/session'
import { useNavigation } from '@/store/navigation'
import { StandCanvas } from './StandCanvas'
import s from './StandBuilderScreen.module.css'

type Step = 'main' | 'stand' | 'journal' | 'classes'

const STEPS: { key: Step; title: string }[] = [
  { key: 'main', title: 'Основное' },
  { key: 'stand', title: 'Стенд' },
  { key: 'journal', title: 'Журнал' },
  { key: 'classes', title: 'Классы' },
]

export function StandBuilderScreen() {
  const draft = useStand((state) => state.draft)
  const selectedId = useStand((state) => state.selectedId)
  const pending = useStand((state) => state.pending)
  const notice = useStand((state) => state.notice)

  const patch = useStand((state) => state.patch)
  const select = useStand((state) => state.select)
  const move = useStand((state) => state.move)
  const remove = useStand((state) => state.remove)
  const addComponent = useStand((state) => state.addComponent)
  const updateParams = useStand((state) => state.updateParams)
  const tapTerminal = useStand((state) => state.tapTerminal)
  const cancelPending = useStand((state) => state.cancelPending)
  const disconnect = useStand((state) => state.disconnect)
  const addColumn = useStand((state) => state.addColumn)
  const removeColumn = useStand((state) => state.removeColumn)
  const updateColumn = useStand((state) => state.updateColumn)
  const toggleClass = useStand((state) => state.toggleClass)
  const setVisibility = useStand((state) => state.setVisibility)

  const profile = useSession((state) => state.profile)
  const go = useNavigation((state) => state.go)

  const [step, setStep] = useState<Step>('main')
  const [saving, setSaving] = useState(false)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(true)

  const selected = draft.model.stand.components.find((item) => item.id === selectedId)
  const selectedSpec = selected ? getComponent(selected.key) : undefined

  const portOptions = useMemo(() => {
    return draft.model.stand.components.flatMap((component) => {
      const spec = getComponent(component.key)
      if (!spec) return []

      return spec.ports
        .filter((port) => !port.readonly || port.dir === 'out')
        .map((port) => ({
          componentId: component.id,
          componentTitle: spec.title,
          portId: port.id,
          label: `${spec.title} · ${port.label}`,
          unit: port.unit.symbol,
        }))
    })
  }, [draft.model.stand.components])

  async function publish() {
    if (!profile) return

    const issues = useStand.getState().validate(true)
    if (issues.length > 0) {
      setIssuesOpen(true)
      return
    }

    setSaving(true)
    setError(null)

    try {
      await api.createLab(draft, profile)
      useStand.getState().reset()
      go({ name: 'catalog' })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить работу')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen
      header={
        <AppHeader
          title="Новая работа"
          subtitle={draft.title || 'без названия'}
          onBack={() => window.history.back()}
          action={
            <Button variant="primary" size="small" loading={saving} onClick={() => void publish()}>
              Опубликовать
            </Button>
          }
        />
      }
    >
      <div className={s.steps}>
        {STEPS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={[s.step, step === item.key ? s.stepActive : ''].join(' ')}
            onClick={() => setStep(item.key)}
          >
            {item.title}
          </button>
        ))}
      </div>

      {step === 'stand' ? (
        <ScreenBody>
          <StandCanvas
            stand={draft.model.stand}
            values={{}}
            time={0}
            running={false}
            editable
            selectedId={selectedId}
            pendingTerminal={pending}
            onSelect={select}
            onMove={move}
            onTerminal={tapTerminal}
          />

          {notice ? (
            <div className={s.notice}>
              <IconAlert width={16} height={16} />
              <Typography.Label variant="small">{notice}</Typography.Label>
            </div>
          ) : null}

          {pending ? (
            <div className={s.pending}>
              <Typography.Label variant="small">
                Провод начат: тапните по клемме другого прибора. Соединять можно только совместимые величины.
              </Typography.Label>
              <Button variant="ghost" size="xsmall" onClick={cancelPending}>
                Отменить
              </Button>
            </div>
          ) : null}
          <div className={s.palette}>
            <button
              type="button"
              className={s.paletteToggle}
              aria-expanded={paletteOpen}
              onClick={() => setPaletteOpen((open) => !open)}
            >
              <span className={s.paletteToggleText}>
                Приборы
                <span className={s.paletteToggleCount}>
                  на стенде: {draft.model.stand.components.length}
                </span>
              </span>
              <IconChevronDown
                width={18}
                height={18}
                className={[s.paletteChevron, paletteOpen ? s.paletteChevronOpen : '']
                  .filter(Boolean)
                  .join(' ')}
              />
            </button>

            {paletteOpen ? (
              <div className={s.paletteBody}>
                {DOMAINS.map((domain) => {
                  const items = componentsOf(domain.key)

                  return (
                    <div key={domain.key} className={s.paletteGroup}>
                      <span className={s.paletteTitle}>{domain.title}</span>
                      <div className={s.paletteRow}>
                        {items.map((spec) => (
                          <button
                            key={spec.key}
                            type="button"
                            className={s.chip}
                            title={spec.hint}
                            onClick={() => addComponent(spec.key)}
                          >
                            <IconPlus width={14} height={14} />
                            {spec.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>

          {selected && selectedSpec ? (
            <div className={s.card}>
              <div className={s.cardHead}>
                <Typography.Title variant="small-strong">{selectedSpec.title}</Typography.Title>
                <Button variant="ghost" size="xsmall" onClick={() => remove(selected.id)}>
                  <IconTrash width={16} height={16} />
                </Button>
              </div>

              {selectedSpec.params.length === 0 ? (
                <Typography.Body variant="small" className={s.hint}>
                  У этого прибора нет настраиваемых параметров.
                </Typography.Body>
              ) : null}

              {selectedSpec.params.map((param) => (
                <label key={param.id} className={s.param}>
                  <span className={s.paramLabel}>
                    {param.label}
                    {param.unit ? `, ${param.unit.symbol}` : ''}
                    {param.of === 'control' ? ' · крутит ученик' : ''}
                  </span>
                  <input
                    className={s.paramInput}
                    type="number"
                    inputMode="decimal"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={selected.params?.[param.id] ?? param.value}
                    onChange={(event) =>
                      updateParams(selected.id, {
                        ...(selected.params ?? {}),
                        [param.id]: Number(event.target.value),
                      })
                    }
                  />
                </label>
              ))}

              <Typography.Label variant="small" className={s.hint}>
                Соединение: тап по клемме прибора, затем по клемме другого. Провод — это и есть связь.
              </Typography.Label>

              {draft.model.stand.links
                .filter((link) => link.from.component === selected.id || link.to.component === selected.id)
                .map((link) => {
                  const other =
                    link.from.component === selected.id ? link.to.component : link.from.component
                  const otherTitle = getComponent(
                    draft.model.stand.components.find((item) => item.id === other)?.key,
                  )?.title

                  return (
                    <div key={link.id} className={s.linkRow}>
                      <Typography.Label variant="small">{otherTitle ?? 'прибор'}</Typography.Label>
                      <Button variant="ghost" size="xsmall" onClick={() => disconnect(link.id)}>
                        Убрать
                      </Button>
                    </div>
                  )
                })}
            </div>
          ) : null}
        </ScreenBody>
      ) : null}

      {step !== 'stand' ? (
        <ScreenScroll>
          {step === 'main' ? (
            <div className={s.card}>
              <div className={s.field}>
                <Typography.Label variant="small" className={s.hint}>
                  Название
                </Typography.Label>
                <Input value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
              </div>

              <div className={s.field}>
                <Typography.Label variant="small" className={s.hint}>
                  Предмет
                </Typography.Label>
                <Input value={draft.subject} onChange={(event) => patch({ subject: event.target.value })} />
              </div>

              <div className={s.field}>
                <Typography.Label variant="small" className={s.hint}>
                  Краткое описание
                </Typography.Label>
                <Input value={draft.summary} onChange={(event) => patch({ summary: event.target.value })} />
              </div>

              <div className={s.field}>
                <Typography.Label variant="small" className={s.hint}>
                  Что нужно получить
                </Typography.Label>
                <Textarea value={draft.goal} onChange={(event) => patch({ goal: event.target.value })} />
              </div>

              <div className={s.field}>
                <Typography.Label variant="small" className={s.hint}>
                  Методические указания
                </Typography.Label>
                <Textarea value={draft.guide} onChange={(event) => patch({ guide: event.target.value })} />
              </div>
            </div>
          ) : null}

          {step === 'journal' ? (
            <>
              <div className={s.card}>
                <Typography.Title variant="small-strong">Столбцы с приборов</Typography.Title>
                <Typography.Body variant="small" className={s.hint}>
                  Выход прибора — замер, вход — то, что задаёт ученик. Значения таких столбцов
                  записываются автоматически.
                </Typography.Body>

                {portOptions.length === 0 ? (
                  <Typography.Body variant="small" className={s.hint}>
                    Сначала добавьте приборы на стенд.
                  </Typography.Body>
                ) : null}

                {portOptions.map((option) => (
                  <button
                    key={`${option.componentId}-${option.portId}`}
                    type="button"
                    className={s.chip}
                    onClick={() =>
                      addColumn(autoColumn(option.componentId, option.portId, option.label.split(' · ')[1] ?? '', option.unit))
                    }
                  >
                    <IconPlus width={14} height={14} />
                    {option.label}
                  </button>
                ))}
              </div>

              <div className={s.card}>
                <Typography.Title variant="small-strong">Столбец, который считает ученик</Typography.Title>
                <Button
                  variant="secondary"
                  size="medium"
                  stretched
                  onClick={() =>
                    addColumn(manualColumn(nextManualColumnKey(), 'Расчёт', undefined, 2))
                  }
                >
                  Добавить столбец расчёта
                </Button>
              </div>

              <div className={s.card}>
                <Typography.Title variant="small-strong">Журнал работы</Typography.Title>

                {draft.model.journal.length === 0 ? (
                  <Typography.Body variant="small" className={s.hint}>
                    Столбцов пока нет.
                  </Typography.Body>
                ) : null}

                {draft.model.journal.map((column: JournalColumn) => (
                  <div key={column.key} className={s.columnRow}>
                    <input
                      className={s.paramInput}
                      value={column.label}
                      onChange={(event) => updateColumn(column.key, { label: event.target.value })}
                    />
                    <input
                      className={s.paramInput}
                      value={column.unit ?? ''}
                      placeholder="единица"
                      onChange={(event) => updateColumn(column.key, { unit: event.target.value })}
                    />
                    <Typography.Label variant="small" className={s.hint}>
                      {column.source === 'auto' ? 'с прибора' : 'считает ученик'}
                    </Typography.Label>
                    <Button variant="ghost" size="xsmall" onClick={() => removeColumn(column.key)}>
                      <IconTrash width={16} height={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {step === 'classes' ? (
            <div className={s.card}>
              <Typography.Title variant="small-strong">Кому выдать работу</Typography.Title>

              <div className={s.row}>
                <Button
                  variant={draft.visibility === 'private' ? 'primary' : 'secondary'}
                  size="medium"
                  onClick={() => setVisibility('private')}
                >
                  Классам
                </Button>
                <Button
                  variant={draft.visibility === 'public' ? 'primary' : 'secondary'}
                  size="medium"
                  onClick={() => setVisibility('public')}
                >
                  Всем
                </Button>
              </div>

              {draft.visibility === 'private' ? (
                <ClassesPicker selected={draft.assignedClassIds} onToggle={toggleClass} />
              ) : (
                <Typography.Body variant="small" className={s.hint}>
                  Работа появится в каталоге у всех пользователей.
                </Typography.Body>
              )}
            </div>
          ) : null}
        </ScreenScroll>
      ) : null}

      <Sheet
        open={issuesOpen}
        onClose={() => setIssuesOpen(false)}
        title="Работа пока не готова"
        subtitle="Проверьте стенд и журнал"
      >
        <div className={s.issueList}>
          {useStand.getState().issues.map((issue) => (
            <Typography.Body key={issue.message} variant="small">
              · {issue.message}
            </Typography.Body>
          ))}
        </div>
      </Sheet>

      {error ? (
        <Sheet open onClose={() => setError(null)} title="Не удалось сохранить">
          <Typography.Body variant="small">{error}</Typography.Body>
        </Sheet>
      ) : null}
    </Screen>
  )
}

function ClassesPicker({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (id: string) => void
}) {
  const classrooms = useSession((state) => state.classrooms)

  if (classrooms.length === 0) {
    return (
      <Typography.Body variant="small" className={s.hint}>
        Классов пока нет: их создаёт администратор школы.
      </Typography.Body>
    )
  }

  return (
    <div className={s.classList}>
      {classrooms.map((room) => (
        <Button
          key={room.id}
          variant={selected.includes(room.id) ? 'primary' : 'secondary'}
          size="medium"
          onClick={() => onToggle(room.id)}
        >
          {room.label} · {room.studentsCount}
        </Button>
      ))}
    </div>
  )
}
