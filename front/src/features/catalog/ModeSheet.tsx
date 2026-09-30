import { Button, Typography } from '@maxhub/max-ui'
import { Sheet } from '@/components/Sheet'
import { IconBook, IconDownload, IconGauge, IconPlay } from '@/components/icons'
import { api } from '@/api/client'
import { bridgeDownloader, openFileUrl, saveDataUrl } from '@/domain/exportTable'
import { usePlatform } from '@/platform/PlatformProvider'
import type { Lab, LabMode } from '@/domain/types'
import s from './CatalogScreen.module.css'

export interface ModeSheetProps {
  lab: Lab | null
  onClose: () => void
  onPick: (lab: Lab, mode: LabMode) => void
  onGuide: (lab: Lab) => void
}

export function ModeSheet({ lab, onClose, onPick, onGuide }: ModeSheetProps) {
  if (!lab) return null

  const manual = lab.model.journal.filter((column) => column.source === 'manual')
  const manualText =
    manual.length === 0
      ? 'Все столбцы заполняются приборами автоматически.'
      : `Сами заполняете: ${manual
          .map((column) => `${column.label}${column.unit ? `, ${column.unit}` : ''}`)
          .join('; ')}.`

  return (
    <Sheet
      open
      onClose={onClose}
      title={lab.title}
      subtitle={`${lab.subject} · ${lab.authorName}`}
      footer={
        <Button
          variant="secondary"
          size="large"
          stretched
          iconBefore={<IconBook width={18} height={18} />}
          onClick={() => onGuide(lab)}
        >
          Методические указания{lab.guideFile ? ' (файл)' : ''}
        </Button>
      }
    >
      <div className={s.goal}>
        <Typography.Label variant="small" className={s.goalLabel}>
          Что нужно получить
        </Typography.Label>
        <Typography.Body variant="medium" className={s.goalText}>
          {lab.goal || lab.summary}
        </Typography.Body>
      </div>

      <div className={s.modeList}>
        <button type="button" className={[s.modeCard, s.modeCardAccent].join(' ')} onClick={() => onPick(lab, 'work')}>
          <div className={s.modeHead}>
            <span className={s.modeIcon}>
              <IconGauge width={18} height={18} />
            </span>
            <Typography.Title variant="small-strong" className={s.modeTitle}>
              Рабочий режим
            </Typography.Title>
          </div>
          <Typography.Body variant="small" className={s.modeText}>
            Журнал и вывод уйдут учителю. {manualText}
          </Typography.Body>
        </button>

        <button type="button" className={s.modeCard} onClick={() => onPick(lab, 'test')}>
          <div className={s.modeHead}>
            <span className={s.modeIcon}>
              <IconPlay width={18} height={18} />
            </span>
            <Typography.Title variant="small-strong" className={s.modeTitle}>
              Тестовый режим
            </Typography.Title>
          </div>
          <Typography.Body variant="small" className={s.modeText}>
            Просто потренироваться. Замеры останутся у вас и никуда не отправятся.
          </Typography.Body>
        </button>
      </div>
    </Sheet>
  )
}

export function GuideSheet({
  open,
  onClose,
  title,
  labId,
  guide,
  guideFile,
  guideFileName,
}: {
  open: boolean
  onClose: () => void
  title: string
  labId?: string
  guide?: string
  guideFile?: string
  guideFileName?: string
}) {
  const { bridge } = usePlatform()

  function downloadFile() {
    if (!guideFile) return

    const name = guideFileName ?? 'metodichka'
    const url = labId ? api.guideUrl?.(labId) : null

    if (url) {
      const save = bridgeDownloader(bridge)
      if (save) save(url, name)
      else openFileUrl(url)
      return
    }

    saveDataUrl(guideFile, name, bridgeDownloader(bridge))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Методические указания"
      subtitle={title}
      footer={
        <>
          {guideFile ? (
            <Button
              variant="primary"
              size="large"
              stretched
              iconBefore={<IconDownload width={18} height={18} />}
              onClick={downloadFile}
            >
              Открыть файлом{guideFileName ? `: ${guideFileName}` : ''}
            </Button>
          ) : null}
          <Button variant="secondary" size="large" stretched onClick={onClose}>
            Понятно
          </Button>
        </>
      }
    >
      <Typography.Body variant="medium" style={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>
        {guide?.trim() || 'Учитель не приложил указаний к этой работе.'}
      </Typography.Body>
    </Sheet>
  )
}
