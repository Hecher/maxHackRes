import { useState } from 'react'
import { Button, Input, Typography } from '@maxhub/max-ui'
import { ScreenScroll } from '@/components/AppShell'
import { API_BASE_URL } from '@/api/client'
import { usePlatform } from '@/platform/PlatformProvider'
import { useSession } from '@/store/session'
import { IconUser } from '@/components/icons'
import s from './ProfileScreen.module.css'

export function ProfileScreen() {
  const profile = useSession((state) => state.profile)
  const switchRole = useSession((state) => state.switchRole)
  const updateProfile = useSession((state) => state.updateProfile)
  const error = useSession((state) => state.error)
  const platform = usePlatform()

  const [school, setSchool] = useState(profile?.school ?? '')
  const [grade, setGrade] = useState(profile?.classNumber ? String(profile.classNumber) : '')
  const [saving, setSaving] = useState(false)

  if (!profile) {
    return (
      <ScreenScroll>
        <Typography.Body variant="medium" className={s.muted}>
          Профиль ещё не загружен.
        </Typography.Body>
      </ScreenScroll>
    )
  }

  const isTeacher = profile.role === 'teacher'
  const needsClassroom = !isTeacher && (!profile.school || !profile.classNumber)

  async function saveClassroom() {
    setSaving(true)
    await updateProfile({
      school: school.trim() || undefined,
      class_number: grade ? Number(grade) : undefined,
    })
    setSaving(false)
  }

  return (
    <ScreenScroll>
      <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.avatar}>
          {profile.photoUrl ? (
            <img className={s.avatarImg} src={profile.photoUrl} alt="" />
          ) : (
            <IconUser width={28} height={28} />
          )}
        </div>
        <div className={s.identity}>
          <Typography.Title variant="small-strong" className={s.name}>
            {profile.fullName}
          </Typography.Title>
          <Typography.Label variant="small" className={s.muted}>
            {isTeacher ? 'Учитель' : `Ученик${profile.classNumber ? `, ${profile.classNumber} класс` : ''}`}
            {profile.username ? ` · @${profile.username}` : ''}
          </Typography.Label>
        </div>
      </div>

      <div className={s.rows}>
        <Row label="Школа" value={profile.school} />
        <Row label="Город" value={profile.city} />
        {isTeacher ? (
          <Row label="Предметы" value={profile.subjects?.join(', ') ?? '—'} />
        ) : (
          <Row label="Класс" value={profile.classNumber ? `${profile.classNumber}` : '—'} />
        )}
        <Row label="Пользователь MAX" value={String(profile.id)} />
        <Row label="Адрес API" value={API_BASE_URL} />
        <Row label="Платформа запуска" value={platform.inMax ? platform.platform : `${platform.platform} (вне MAX)`} />
        {platform.deviceName ? <Row label="Устройство" value={platform.deviceName} /> : null}
        {platform.version ? <Row label="Версия MAX" value={platform.version} /> : null}
      </div>

      
      {needsClassroom ? (
        <div className={s.roleSwitch}>
          <Typography.Label variant="medium-strong">Школа и класс</Typography.Label>
          <Typography.Body variant="small" className={s.note}>
            Без класса вам не видны работы, которые учитель выдал классу. В боте эти
            данные заполняются при регистрации.
          </Typography.Body>
          <Input
            value={school}
            placeholder="Школа, например МАОУ СОШ № 27"
            onChange={(event) => setSchool(event.target.value)}
          />
          <Input
            value={grade}
            inputMode="numeric"
            placeholder="Номер класса, например 8"
            onChange={(event) => setGrade(event.target.value)}
          />
          <Button
            variant="primary"
            size="medium"
            stretched
            loading={saving}
            disabled={!school.trim() || !grade}
            onClick={() => void saveClassroom()}
          >
            Сохранить
          </Button>
          {error ? (
            <Typography.Label variant="small" style={{ color: 'var(--text-negative)' }}>
              {error}
            </Typography.Label>
          ) : null}
        </div>
      ) : null}

      {}
      {!platform.inMax ? (
        <div className={s.roleSwitch}>
          <Typography.Label variant="medium-strong">Роль для проверки</Typography.Label>
          <Typography.Body variant="small" className={s.note}>
            Приложение открыто вне MAX, поэтому роль можно переключить вручную:
            в мессенджере её определяет бот при регистрации.
          </Typography.Body>
          <div className={s.roleButtons}>
            <Button
              className={s.grow}
              variant={!isTeacher ? 'primary' : 'secondary'}
              size="medium"
              stretched
              onClick={() => void switchRole('student')}
            >
              Ученик
            </Button>
            <Button
              className={s.grow}
              variant={isTeacher ? 'primary' : 'secondary'}
              size="medium"
              stretched
              onClick={() => void switchRole('teacher')}
            >
              Учитель
            </Button>
          </div>
        </div>
      ) : null}
      </div>
    </ScreenScroll>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.row}>
      <Typography.Label variant="medium" className={s.muted}>
        {label}
      </Typography.Label>
      <Typography.Body variant="medium" className={s.rowValue}>
        {value}
      </Typography.Body>
    </div>
  )
}
