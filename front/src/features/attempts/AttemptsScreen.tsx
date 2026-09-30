import { useEffect, useMemo, useState } from 'react'
import { Button, Typography } from '@maxhub/max-ui'
import { ScreenScroll } from '@/components/AppShell'
import { api, ApiError } from '@/api/client'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { SegmentControl } from '@/components/SegmentControl'
import { Sheet } from '@/components/Sheet'
import { cellText, checkAttempt } from '@/domain'
import { DependencyChart } from './DependencyChart'
import { bridgeDownloader, openFileUrl, saveBlob } from '@/domain/exportTable'
import type { Attempt, Lab } from '@/domain/types'
import { usePlatform } from '@/platform/PlatformProvider'
import { useSession } from '@/store/session'
import { IconChecklist, IconDownload } from '@/components/icons'
import s from './AttemptsScreen.module.css'

type Filter = 'all' | 'pending' | 'checked'

export function AttemptsScreen() {
  const profile = useSession((state) => state.profile)
  const { bridge } = usePlatform()

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Attempt[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [opened, setOpened] = useState<Attempt | null>(null)
  
  const [openedLab, setOpenedLab] = useState<Lab | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    void (async () => {
      setStatus('loading')
      try {
        const attempts = await api.listAttempts(profile)
        if (!cancelled) {
          setItems(attempts)
          setStatus('ready')
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить сдачи')
          setStatus('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [profile])

  const isTeacher = profile?.role === 'teacher'

  const visible = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'pending') return items.filter((item) => item.verdict === 'pending')
    return items.filter((item) => item.verdict !== 'pending')
  }, [items, filter])

  const check = useMemo(
    () => (opened ? checkAttempt(opened.rows, opened.columns, openedLab?.model) : null),
    [opened, openedLab],
  )

  
  const chart = useMemo(() => {
    if (!opened || opened.rows.length < 2) return null

    const auto = opened.columns.filter((column) => column.source === 'auto')
    const xColumn = auto[0]
    const yColumn = auto[1]
    if (!xColumn || !yColumn) return null

    const points = opened.rows
      .map((row) => ({ x: row.values[xColumn.key], y: row.values[yColumn.key] }))
      .filter(
        (point): point is { x: number; y: number } =>
          typeof point.x === 'number' && typeof point.y === 'number',
      )

    if (points.length < 2) return null

    return {
      points,
      labelX: `${xColumn.label}${xColumn.unit ? `, ${xColumn.unit}` : ''}`,
      labelY: `${yColumn.label}${yColumn.unit ? `, ${yColumn.unit}` : ''}`,
    }
  }, [opened])

  const summary = useMemo(() => {
    const checked = items.filter((item) => item.verdict !== 'pending')
    const grades = checked.map((item) => item.grade).filter((grade): grade is number => grade !== null)

    let rowsTotal = 0
    let rowsCorrect = 0
    for (const item of items) {
      const result = checkAttempt(item.rows, item.columns)
      rowsTotal += result.checked
      rowsCorrect += result.correct
    }

    return {
      total: items.length,
      checked: checked.length,
      average: grades.length > 0 ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10 : null,
      rowsTotal,
      rowsCorrect,
    }
  }, [items])

  async function review(attempt: Attempt, verdict: 'accepted' | 'needs_work', grade: number) {
    setSaving(true)
    setError(null)
    try {
      await api.reviewAttempt?.(attempt.id, { grade, comment: comment.trim() || null })
      setItems((prev) =>
        prev.map((item) =>
          item.id === attempt.id ? { ...item, verdict, grade, comment: comment.trim() || null } : item,
        ),
      )
      setOpened(null)
      setComment('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось выставить оценку')
    } finally {
      setSaving(false)
    }
  }

  async function downloadJournal(attemptId: string) {
    const name = `attempt-${attemptId}.xls`
    const url = api.attemptExportUrl?.(attemptId)

    if (url) {
      const save = bridgeDownloader(bridge)
      if (save) save(url, name)
      else openFileUrl(url)
      return
    }

    try {
      const blob = await api.downloadAttemptExport?.(attemptId)
      if (!blob) return
      saveBlob(blob, name, bridgeDownloader(bridge))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось скачать журнал')
    }
  }

  
  async function openAttempt(attempt: Attempt) {
    setOpened(attempt)
    setComment(attempt.comment ?? '')
    setOpenedLab(null)

    try {
      const lab = await api.getLab(attempt.labId)
      setOpenedLab(lab)
    } catch {
    }
  }

  if (status === 'loading') return <LoadingState label="Загружаем сдачи…" />

  if (status === 'error') {
    return <ErrorState message={error ?? 'Сдачи недоступны'} hint="Попробуйте открыть раздел позже" />
  }

  return (
    <ScreenScroll>
      <div className={s.wrap}>
        {isTeacher ? (
          <div className={s.filters}>
            <SegmentControl<Filter>
              ariaLabel="Фильтр сдач"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Все', count: items.length },
                {
                  value: 'pending',
                  label: 'Проверить',
                  count: items.filter((item) => item.verdict === 'pending').length,
                },
                {
                  value: 'checked',
                  label: 'Проверено',
                  count: items.filter((item) => item.verdict !== 'pending').length,
                },
              ]}
            />
          </div>
        ) : null}

        {isTeacher && items.length > 0 ? (
          <div className={s.stats}>
            <div className={s.stat}>
              <Typography.Title variant="small-strong" className={s.statValue}>
                {summary.total}
              </Typography.Title>
              <Typography.Label variant="small" className={s.statLabel}>
                сдач
              </Typography.Label>
            </div>
            <div className={s.stat}>
              <Typography.Title variant="small-strong" className={s.statValue}>
                {summary.total - summary.checked}
              </Typography.Title>
              <Typography.Label variant="small" className={s.statLabel}>
                на проверке
              </Typography.Label>
            </div>
            <div className={s.stat}>
              <Typography.Title variant="small-strong" className={s.statValue}>
                {summary.average !== null ? summary.average : '—'}
              </Typography.Title>
              <Typography.Label variant="small" className={s.statLabel}>
                средняя оценка
              </Typography.Label>
            </div>
            <div className={s.stat}>
              <Typography.Title variant="small-strong" className={s.statValue}>
                {summary.rowsTotal > 0
                  ? `${Math.round((summary.rowsCorrect / summary.rowsTotal) * 100)}%`
                  : '—'}
              </Typography.Title>
              <Typography.Label variant="small" className={s.statLabel}>
                расчётов верно
              </Typography.Label>
            </div>
          </div>
        ) : null}

        {visible.length === 0 ? (
          <EmptyState
            icon={<IconChecklist />}
            title={isTeacher ? 'Проверять нечего' : 'Сдач пока нет'}
            message={
              isTeacher
                ? 'Как только ученики завершат работы в рабочем режиме, журналы появятся здесь.'
                : 'Пройдите работу в рабочем режиме и нажмите «Завершить» — сдача появится здесь.'
            }
          />
        ) : null}

        {visible.map((attempt) => (
          <button
            key={attempt.id}
            type="button"
            className={s.item}
            onClick={() => void openAttempt(attempt)}
          >
            <div className={s.itemTop}>
              <Typography.Title variant="small-strong" className={s.itemTitle}>
                {attempt.labTitle}
              </Typography.Title>
              <span
                className={[
                  s.status,
                  attempt.verdict === 'pending'
                    ? s.statusPending
                    : attempt.verdict === 'accepted'
                      ? s.statusAccepted
                      : s.statusNeedsWork,
                ].join(' ')}
              >
                {attempt.verdict === 'pending'
                  ? 'На проверке'
                  : attempt.verdict === 'accepted'
                    ? 'Принято'
                    : 'На доработку'}
              </span>
            </div>

            <div className={s.itemMeta}>
              <Typography.Label variant="small">
                {isTeacher
                  ? attempt.studentName
                  : attempt.mode === 'work'
                    ? 'Рабочий режим'
                    : 'Тестовый режим'}
              </Typography.Label>
              <span className={s.dot} />
              <Typography.Label variant="small">
                {new Date(attempt.submittedAt ?? attempt.startedAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                })}
              </Typography.Label>
              {attempt.grade !== null ? (
                <>
                  <span className={s.dot} />
                  <Typography.Label variant="small" className={s.grade}>
                    Оценка: {attempt.grade}
                  </Typography.Label>
                </>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <Sheet
        open={opened !== null}
        onClose={() => setOpened(null)}
        title={opened?.labTitle ?? ''}
        subtitle={opened ? (isTeacher ? opened.studentName : 'Ваша сдача') : undefined}
        footer={
          opened ? (
            <>
              {isTeacher ? (
                <div className={s.gradeRow}>
                  <Button
                    className={s.grow}
                    variant="secondary"
                    size="large"
                    stretched
                    loading={saving}
                    onClick={() => void review(opened, 'needs_work', 3)}
                  >
                    На доработку
                  </Button>
                  <Button
                    className={s.grow}
                    variant="primary"
                    size="large"
                    stretched
                    loading={saving}
                    onClick={() => void review(opened, 'accepted', 5)}
                  >
                    Принять
                  </Button>
                </div>
              ) : null}

              {opened.rows.length > 0 ? (
                <Button
                  variant="secondary"
                  size="medium"
                  stretched
                  iconBefore={<IconDownload width={18} height={18} />}
                  onClick={() => void downloadJournal(opened.id)}
                >
                  Скачать журнал файлом
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {opened ? (
          <div className={s.sheetBody}>
            {opened.rows.length > 0 && opened.columns.length > 0 ? (
              <>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>№</th>
                      {opened.columns.map((column) => (
                        <th key={column.key}>
                          {column.label}
                          {column.unit ? `, ${column.unit}` : ''}
                        </th>
                      ))}
                      <th>Расчёт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opened.rows.map((row) => {
                      const rowCheck = check?.rows.find((item) => item.rowNumber === row.number)
                      return (
                        <tr key={row.id}>
                          <td>{row.number}</td>
                          {opened.columns.map((column) => (
                            <td key={column.key}>
                              {cellText(row.values[column.key] ?? null, column)}
                            </td>
                          ))}
                          <td>
                            {rowCheck === undefined || rowCheck.ok === null ? (
                              <span className={`${s.mark} ${s.markUnknown}`}>—</span>
                            ) : rowCheck.ok ? (
                              <span className={`${s.mark} ${s.markOk}`}>✓</span>
                            ) : (
                              <span className={`${s.mark} ${s.markBad}`}>✗</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {chart ? (
                  <div className={s.section}>
                    <Typography.Label variant="small" style={{ color: 'var(--text-tertiary)' }}>
                      Зависимость по журналу
                    </Typography.Label>
                    <DependencyChart
                      points={chart.points}
                      labelX={chart.labelX}
                      labelY={chart.labelY}
                    />
                  </div>
                ) : null}

                {check && check.checked > 0 ? (
                  <div className={s.summary}>
                    <Typography.Label variant="small">
                      Расчёт сошёлся в {check.correct} из {check.checked}
                    </Typography.Label>
                    <Typography.Label variant="small">допуск 8 %</Typography.Label>
                  </div>
                ) : (
                  <Typography.Label variant="small" style={{ color: 'var(--text-tertiary)' }}>
                    Автоматическая сверка к этой работе не применяется.
                  </Typography.Label>
                )}
              </>
            ) : (
              <Typography.Body variant="small" style={{ color: 'var(--text-tertiary)' }}>
                В этой сдаче нет записанных замеров.
              </Typography.Body>
            )}

            {opened.conclusion ? (
              <div className={s.section}>
                <Typography.Label variant="small" style={{ color: 'var(--text-tertiary)' }}>
                  Вывод ученика
                </Typography.Label>
                <Typography.Body variant="small" style={{ color: 'var(--text-primary)' }}>
                  {opened.conclusion}
                </Typography.Body>
              </div>
            ) : null}

            {isTeacher ? (
              <label className={s.section}>
                <Typography.Label variant="small" style={{ color: 'var(--text-tertiary)' }}>
                  Комментарий ученику
                </Typography.Label>
                <textarea
                  className={s.comment}
                  value={comment}
                  placeholder="Что проверить или исправить"
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
            ) : opened.comment ? (
              <Typography.Body variant="small" style={{ color: 'var(--text-secondary)' }}>
                {opened.comment}
              </Typography.Body>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </ScreenScroll>
  )
}
