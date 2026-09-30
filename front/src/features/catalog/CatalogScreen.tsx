import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Icon16SearchOutline, Input, Typography } from '@maxhub/max-ui'
import { AppHeader, Screen, ScreenBody, ScreenScroll } from '@/components/AppShell'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { api } from '@/api/client'
import { flushPending, pendingCount } from '@/api/offlineQueue'
import { LabCard } from '@/components/LabCard'
import { SegmentControl } from '@/components/SegmentControl'
import { IconFlask, IconPlus } from '@/components/icons'
import { useCatalog } from '@/store/catalog'
import { useNavigation } from '@/store/navigation'
import { useSession } from '@/store/session'
import type { Lab, LabMode, Visibility } from '@/domain/types'
import { GuideSheet, ModeSheet } from './ModeSheet'
import s from './CatalogScreen.module.css'

export function CatalogScreen({ tabbar }: { tabbar?: ReactNode }) {
  const profile = useSession((state) => state.profile)
  const classrooms = useSession((state) => state.classrooms)

  const status = useCatalog((state) => state.status)
  const error = useCatalog((state) => state.error)
  const tab = useCatalog((state) => state.tab)
  const query = useCatalog((state) => state.query)
  const privateLabs = useCatalog((state) => state.privateLabs)
  const publicLabs = useCatalog((state) => state.publicLabs)
  const load = useCatalog((state) => state.load)
  const setTab = useCatalog((state) => state.setTab)
  const setQuery = useCatalog((state) => state.setQuery)

  const go = useNavigation((state) => state.go)
  const [pickedLab, setPickedLab] = useState<Lab | null>(null)
  
  const [guideLab, setGuideLab] = useState<Lab | null>(null)

  useEffect(() => {
    if (profile) void load(profile)
  }, [profile, load])

  const labs = useMemo(() => {
    const source = tab === 'private' ? privateLabs : publicLabs
    const needle = query.trim().toLowerCase()
    if (!needle) return source
    return source.filter(
      (lab) =>
        lab.title.toLowerCase().includes(needle) ||
        lab.summary.toLowerCase().includes(needle) ||
        lab.authorName.toLowerCase().includes(needle),
    )
  }, [tab, query, privateLabs, publicLabs])

  const isTeacher = profile?.role === 'teacher'

  
  const [queued, setQueued] = useState(() => pendingCount())

  useEffect(() => {
    setQueued(pendingCount())
    const update = () => setQueued(pendingCount())
    window.addEventListener('online', update)
    return () => window.removeEventListener('online', update)
  }, [])

  function openLab(lab: Lab, mode: LabMode) {
    setPickedLab(null)
    go({ name: 'lab', labId: lab.id, mode })
  }

  if (!profile) {
    return (
      <Screen header={<AppHeader title="Лабораторные работы" />} tabbar={tabbar}>
        <ScreenBody>
          <LoadingState label="Определяем, кто вы…" />
        </ScreenBody>
      </Screen>
    )
  }

  const subtitleParts = [
    isTeacher ? null : profile.classNumber ? `${profile.classNumber} класс` : null,
    isTeacher ? profile.subjects?.join(', ') : profile.school,
  ].filter((part): part is string => Boolean(part))
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : isTeacher ? 'Учитель' : 'Ученик'

  const total = privateLabs.length + publicLabs.length

  async function flushQueue() {
    await flushPending((attempt) => api.submitAttempt(attempt))
    setQueued(pendingCount())
  }

  return (
    <Screen
      tabbar={tabbar}
      header={
        <AppHeader
          title="Лабораторные работы"
          subtitle={subtitle}
          action={
            isTeacher ? (
              <Button
                variant="secondary"
                size="small"
                iconBefore={<IconPlus width={18} height={18} />}
                onClick={() => go({ name: 'builder' })}
              >
                Создать
              </Button>
            ) : null
          }
        />
      }
    >
      <ScreenBody>
        <div className={s.toolbar}>
          <SegmentControl<Visibility>
            ariaLabel="Каталог работ"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'private', label: 'Частные', count: privateLabs.length },
              { value: 'public', label: 'Публичные', count: publicLabs.length },
            ]}
          />

          {total > 4 ? (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по названию или автору"
              iconBefore={<Icon16SearchOutline />}
              withClearButton
              aria-label="Поиск по каталогу"
            />
          ) : null}
        </div>

        <ScreenScroll>
          {queued > 0 ? (
            <div className={s.queued}>
              <div className={s.queuedText}>
                <Typography.Label variant="medium-strong">
                  {queued} {queued === 1 ? 'работа ждёт' : 'работ ждут'} отправки
                </Typography.Label>
                <Typography.Label variant="small" className={s.queuedHint}>
                  Они сохранены на устройстве и уйдут учителю, когда появится связь.
                </Typography.Label>
              </div>
              <Button variant="secondary" size="medium" onClick={() => void flushQueue()}>
                Отправить
              </Button>
            </div>
          ) : null}

          {status === 'loading' && total === 0 ? <LoadingState label="Загружаем работы…" /> : null}

          {status === 'error' ? (
            <ErrorState
              message={error ?? 'Каталог недоступен'}
              hint="Проверьте соединение и попробуйте снова"
              onAction={() => void load(profile, { force: true })}
            />
          ) : null}

          {status === 'ready' && labs.length === 0 ? (
            <EmptyState
              icon={<IconFlask />}
              title={tab === 'private' ? 'Здесь пока пусто' : 'Публичных работ ещё нет'}
              message={
                tab === 'private'
                  ? isTeacher
                    ? 'Вы ещё не создавали работ. Соберите первую — и она появится здесь.'
                    : 'Учитель ещё не выдал вам работы. Загляните во вкладку «Публичные».'
                  : 'Первым поделиться работой может любой автор.'
              }
              actionLabel={isTeacher && tab === 'private' ? 'Собрать работу' : undefined}
              onAction={isTeacher && tab === 'private' ? () => go({ name: 'builder' }) : undefined}
            />
          ) : null}

          {labs.length > 0 ? (
            <div className={s.list}>
              {labs.map((lab) => (
                <LabCard key={lab.id} lab={lab} classrooms={classrooms} onOpen={setPickedLab} />
              ))}
            </div>
          ) : null}
        </ScreenScroll>
      </ScreenBody>

      <ModeSheet
        lab={pickedLab}
        onClose={() => setPickedLab(null)}
        onPick={openLab}
        onGuide={(lab) => setGuideLab(lab)}
      />

      <GuideSheet
        open={guideLab !== null}
        onClose={() => setGuideLab(null)}
        title={guideLab?.title ?? ''}
        labId={guideLab?.id}
        guide={guideLab?.guide}
        guideFile={guideLab?.guideFile}
        guideFileName={guideLab?.guideFileName}
      />
    </Screen>
  )
}
