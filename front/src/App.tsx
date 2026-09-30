import { useEffect, useRef } from 'react'
import { AppHeader, Screen, ScreenBody, TabBar } from '@/components/AppShell'
import { LoadingState, ErrorState } from '@/components/States'
import { api } from '@/api/client'
import { flushPending } from '@/api/offlineQueue'
import { IconChecklist, IconFlask, IconUser } from '@/components/icons'
import { CatalogScreen } from '@/features/catalog/CatalogScreen'
import { StandRunScreen } from '@/features/stand/StandRunScreen'
import { StandBuilderScreen } from '@/features/stand/StandBuilderScreen'
import { AttemptsScreen } from '@/features/attempts/AttemptsScreen'
import { ProfileScreen } from '@/features/profile/ProfileScreen'
import { usePlatform } from '@/platform/PlatformProvider'
import { useNavigation, useCurrentScreen } from '@/store/navigation'
import { useSession } from '@/store/session'

const ROOT_SCREENS = new Set(['catalog', 'attempts', 'profile'])

export function App() {
  const { ready, initData, startParams, initDataRaw } = usePlatform()
  const screen = useCurrentScreen()
  const go = useNavigation((state) => state.go)
  const reset = useNavigation((state) => state.reset)

  const init = useSession((state) => state.init)
  const profile = useSession((state) => state.profile)
  const sessionStatus = useSession((state) => state.status)
  const sessionError = useSession((state) => state.error)

  const lastInitKey = useRef<string | null>(null)

  useEffect(() => {
    if (!ready) return

    const key = initDataRaw ?? `anonymous:${startParams.raw ?? ''}`
    if (lastInitKey.current === key) return
    lastInitKey.current = key

    void init({
      userId: initData?.user?.id,
      startParams,
      initDataRaw,
    })
  }, [ready, initDataRaw, initData, startParams, init])

  useEffect(() => {
    const onPop = () => useNavigation.getState().popFromHistory()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const flush = () => {
      void flushPending((attempt) => api.submitAttempt(attempt))
    }

    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [])

  useEffect(() => {
    if (sessionStatus !== 'ready') return
    if (!startParams.labId) return
    if (useNavigation.getState().stack.length > 1) return
    go({ name: 'lab', labId: startParams.labId, mode: startParams.mode ?? 'test' })
  }, [sessionStatus, startParams.labId, startParams.mode, go])

  const isTeacher = profile?.role === 'teacher'
  const showTabbar = ROOT_SCREENS.has(screen.name)

  const tabbar = showTabbar ? (
    <TabBar
      active={screen.name}
      onChange={(key) => reset({ name: key as 'catalog' | 'attempts' | 'profile' })}
      items={[
        { key: 'catalog', label: 'Работы', icon: <IconFlask width={22} height={22} /> },
        {
          key: 'attempts',
          label: isTeacher ? 'Проверка' : 'Мои сдачи',
          icon: <IconChecklist width={22} height={22} />,
        },
        { key: 'profile', label: 'Профиль', icon: <IconUser width={22} height={22} /> },
      ]}
    />
  ) : undefined

  if (!profile) {
    return (
      <Screen header={<AppHeader title="Виртуальные лабораторные" />}>
        <ScreenBody>
          {sessionStatus === 'error' ? (
            <ErrorState
              title="Не удалось определить пользователя"
              message={sessionError ?? 'Сервис не ответил'}
              hint="Проверьте соединение и повторите попытку"
              onAction={() => void init({ userId: initData?.user?.id, startParams, initDataRaw })}
            />
          ) : (
            <LoadingState label="Готовим рабочее место…" />
          )}
        </ScreenBody>
      </Screen>
    )
  }

  switch (screen.name) {
    case 'lab':
      return <StandRunScreen labId={screen.labId} mode={screen.mode} />

    case 'builder':
      return <StandBuilderScreen />

    case 'attempts':
      return (
        <Screen header={<AppHeader title={isTeacher ? 'Работы на проверку' : 'Мои сдачи'} />} tabbar={tabbar}>
          <ScreenBody>
            <AttemptsScreen />
          </ScreenBody>
        </Screen>
      )

    case 'profile':
      return (
        <Screen header={<AppHeader title="Профиль" />} tabbar={tabbar}>
          <ScreenBody>
            <ProfileScreen />
          </ScreenBody>
        </Screen>
      )

    case 'catalog':
    default:
      return <CatalogScreen tabbar={tabbar} />
  }
}
