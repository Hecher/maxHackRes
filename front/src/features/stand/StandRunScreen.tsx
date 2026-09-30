import { useEffect, useMemo, useState } from 'react'
import { Button, Textarea, Typography } from '@maxhub/max-ui'
import { AppHeader, Screen, ScreenBody } from '@/components/AppShell'
import { ErrorState, LoadingState } from '@/components/States'
import { Sheet } from '@/components/Sheet'
import { IconBook, IconChevronDown, IconFlag, IconPlay, IconStop } from '@/components/icons'
import { api } from '@/api/client'
import { ApiError } from '@/api/contract'
import { getComponent } from '@/sim'
import { rowValues, snapshot, useRun } from '@/store/run'
import { useSession } from '@/store/session'
import { useRunClock } from '@/features/stand/useRunClock'
import { StandCanvas } from '@/features/stand/StandCanvas'
import { GuideSheet } from '@/features/catalog/ModeSheet'
import type { Lab, LabMode } from '@/domain/types'
import s from './StandRunScreen.module.css'

export interface StandRunScreenProps {
  labId: string
  mode: LabMode
}

export function StandRunScreen({ labId, mode }: StandRunScreenProps) {
  const [lab, setLab] = useState<Lab | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [manual, setManual] = useState<Record<string, string>>({})
  const [controlsOpen, setControlsOpen] = useState(true)

  const profile = useSession((state) => state.profile)
  const run = useRun()
  const time = useRunClock(run.running)

  useEffect(() => {
    let alive = true

    api
      .getLab(labId)
      .then((loaded) => {
        if (alive) setLab(loaded)
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof ApiError ? caught.message : 'Работа не загрузилась')
      })

    return () => {
      alive = false
    }
  }, [labId])

  
  useEffect(() => {
    useRun.getState().reset()
    setManual({})
  }, [labId])

  const current = useMemo(
    () => (lab ? snapshot(lab.model.stand, time) : { values: {}, issues: [] }),
    [lab, time],
  )

  const controls = useMemo(() => {
    if (!lab) return []

    return lab.model.stand.components.flatMap((component) => {
      const spec = getComponent(component.key)
      if (!spec) return []

      return spec.params
        .filter((param) => param.of === 'control')
        .map((param) => ({
          componentId: component.id,
          componentTitle: spec.title,
          param,
          value: component.params?.[param.id] ?? param.value,
        }))
    })
  }, [lab])
  if (error) {
    return (
      <Screen header={<AppHeader title="Работа" />}>
        <ScreenBody>
          <ErrorState title="Работа не открылась" message={error} />
        </ScreenBody>
      </Screen>
    )
  }

  if (!lab) {
    return (
      <Screen header={<AppHeader title="Работа" />}>
        <ScreenBody>
          <LoadingState label="Собираем стенд…" />
        </ScreenBody>
      </Screen>
    )
  }

  const journal = lab.model.journal
  const filled = run.rows.map((row) => ({ ...row, values: { ...rowValues(lab.model.stand, journal, current.values), ...row.values } }))
  const manualColumns = journal.filter((column) => column.source === 'manual')
  const missingManual = filled.some((row) => manualColumns.some((column) => row.values[column.key] == null))

  function record() {
    if (!lab) return
    const values = rowValues(lab.model.stand, lab.model.journal, current.values)
    useRun.setState({ rows: [...useRun.getState().rows, { id: `r${Date.now()}`, number: useRun.getState().rows.length + 1, values }] })
  }

  function updateManual(rowId: string, key: string, value: string) {
    setManual((state) => ({ ...state, [`${rowId}:${key}`]: value }))

    useRun.setState({
      rows: useRun.getState().rows.map((row) =>
        row.id === rowId
          ? { ...row, values: { ...row.values, [key]: value === '' ? null : Number(value.replace(',', '.')) } }
          : row,
      ),
    })
  }

  async function submit() {
    if (!lab || !profile) return

    try {
      const now = new Date().toISOString()

      await api.submitAttempt({
        id: '',
        labId: lab.id,
        labTitle: lab.title,
        studentId: profile.id,
        studentName: profile.fullName,
        mode,
        status: 'submitted',
        rows: filled,
        columns: journal,
        grade: null,
        verdict: 'pending',
        conclusion: run.conclusion,
        comment: null,
        startedAt: now,
        submittedAt: now,
      })

      useRun.getState().reset()
      setFinishOpen(false)
      setError(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось отправить работу')
    }
  }

  return (
    <Screen
      header={
        <AppHeader
          title={lab.title}
          subtitle={mode === 'work' ? 'Рабочий режим' : 'Тестовый режим'}
          onBack={() => window.history.back()}
          action={
            <Button variant="ghost" size="small" onClick={() => setGuideOpen(true)}>
              <IconBook width={18} height={18} />
            </Button>
          }
        />
      }
    >
      <ScreenBody>
        <StandCanvas
          stand={lab.model.stand}
          values={current.values}
          time={time}
          running={run.running}
          issues={current.issues}
        />

        <div className={s.panel}>
          {controls.length > 0 ? (
            <button
              type="button"
              className={s.panelToggle}
              aria-expanded={controlsOpen}
              onClick={() => setControlsOpen((open) => !open)}
            >
              <span className={s.panelToggleText}>
                Приборы
                <span className={s.panelToggleCount}>
                  настроек: {controls.length}
                </span>
              </span>
              <IconChevronDown
                width={18}
                height={18}
                className={[s.panelChevron, controlsOpen ? s.panelChevronOpen : '']
                  .filter(Boolean)
                  .join(' ')}
              />
            </button>
          ) : null}

          {controlsOpen ? (
            <div className={s.controls}>
              {controls.map((item) => (
                <label key={`${item.componentId}-${item.param.id}`} className={s.control}>
                  <span className={s.controlHead}>
                    <Typography.Label variant="small">
                      {item.param.label}
                      {item.param.unit ? `, ${item.param.unit.symbol}` : ''}
                    </Typography.Label>
                    <Typography.Label variant="small" className={s.controlValue}>
                      {item.value.toLocaleString('ru-RU')}
                    </Typography.Label>
                  </span>
                  <input
                    className={s.range}
                    type="range"
                    min={item.param.min}
                    max={item.param.max}
                    step={item.param.step}
                    value={item.value}
                    onChange={(event) =>
                      setLab((current2) =>
                        current2
                          ? {
                              ...current2,
                              model: {
                                ...current2.model,
                                stand: {
                                  ...current2.model.stand,
                                  components: current2.model.stand.components.map((component) =>
                                    component.id === item.componentId
                                      ? {
                                          ...component,
                                          params: {
                                            ...(component.params ?? {}),
                                            [item.param.id]: Number(event.target.value),
                                          },
                                        }
                                      : component,
                                  ),
                                },
                              },
                            }
                          : current2,
                      )
                    }
                  />
                  <input
                    className={s.paramNumber}
                    type="number"
                    inputMode="decimal"
                    min={item.param.min}
                    max={item.param.max}
                    step={item.param.step}
                    value={item.value}
                    aria-label={`${item.componentTitle}: ${item.param.label}`}
                    onChange={(event) =>
                      setLab((current2) =>
                        current2
                          ? {
                              ...current2,
                              model: {
                                ...current2.model,
                                stand: {
                                  ...current2.model.stand,
                                  components: current2.model.stand.components.map((component) =>
                                    component.id === item.componentId
                                      ? {
                                          ...component,
                                          params: {
                                            ...(component.params ?? {}),
                                            [item.param.id]: Number(event.target.value),
                                          },
                                        }
                                      : component,
                                  ),
                                },
                              },
                            }
                          : current2,
                      )
                    }
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className={s.actions}>
            <Button
              variant={run.running ? 'secondary' : 'primary'}
              size="large"
              stretched
              iconBefore={run.running ? <IconStop width={18} height={18} /> : <IconPlay width={18} height={18} />}
              onClick={() => run.setRunning(!run.running)}
            >
              {run.running ? 'Стоп' : 'Старт'}
            </Button>

            <Button variant="secondary" size="large" stretched onClick={record} disabled={!run.hasRun}>
              Записать
            </Button>

            <Button variant="primary" size="large" stretched onClick={() => setFinishOpen(true)} disabled={run.rows.length === 0}>
              <IconFlag width={18} height={18} /> Завершить
            </Button>
          </div>
        </div>
      </ScreenBody>

      <GuideSheet
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title={lab.title}
        labId={lab.id}
        guide={lab.guide}
        guideFile={lab.guideFile}
        guideFileName={lab.guideFileName}
      />

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Сдача работы"
        subtitle={mode === 'work' ? 'Журнал и вывод уйдут учителю' : 'Тестовый режим: никуда не отправляется'}
        footer={
          <Button
            variant="primary"
            size="large"
            stretched
            disabled={run.conclusion.trim().length < 3 || missingManual}
            onClick={() => void submit()}
          >
            {mode === 'work' ? 'Отправить учителю' : 'Завершить'}
          </Button>
        }
      >
        <Typography.Label variant="small" style={{ color: 'var(--text-tertiary)' }}>
          Вывод по работе
        </Typography.Label>
        <Textarea
          value={run.conclusion}
          placeholder="Что получилось, сходится ли с теорией"
          onChange={(event) => run.setConclusion(event.target.value)}
        />

        {missingManual ? (
          <Typography.Body variant="small" style={{ color: 'var(--text-negative)', marginTop: 12 }}>
            Заполните столбцы, которые считаете сами: {manualColumns.map((column) => column.label).join(', ')}.
          </Typography.Body>
        ) : null}
      </Sheet>

      <div className={s.journal}>
        <Typography.Label variant="small" className={s.journalTitle}>
          Журнал замеров · {run.rows.length}
        </Typography.Label>

        {journal.length === 0 ? (
          <Typography.Body variant="small" className={s.hint}>
            Учитель ещё не настроил журнал.
          </Typography.Body>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>№</th>
                  {journal.map((column) => (
                    <th key={column.key}>
                      {column.label}
                      {column.unit ? <span className={s.unit}>, {column.unit}</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filled.map((row) => (
                  <tr key={row.id}>
                    <td>{row.number}</td>
                    {journal.map((column) => (
                      <td key={column.key}>
                        {column.source === 'manual' ? (
                          <input
                            className={s.cell}
                            inputMode="decimal"
                            value={manual[`${row.id}:${column.key}`] ?? (row.values[column.key] ?? '')}
                            onChange={(event) => updateManual(row.id, column.key, event.target.value)}
                          />
                        ) : (
                          formatCell(row.values[column.key] ?? null, column.precision ?? 2)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {run.rows.length === 0 ? (
          <Typography.Body variant="small" className={s.hint}>
            Нажмите «Старт», дождитесь показаний и запишите замер.
          </Typography.Body>
        ) : null}
      </div>
    </Screen>
  )
}

function formatCell(value: number | null, precision: number): string {
  if (value === null || value === undefined) return '—'
  return value.toFixed(precision).replace('.', ',')
}
