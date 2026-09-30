import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const TARGET = process.argv[2] ?? 'http://localhost:8080/'
const API = process.env.VLR_API ?? 'http://localhost:8000/api/v1'
const PORT = Number(process.env.VLR_PORT ?? 9333)
const VIEWPORT = process.env.VLR_VIEWPORT ?? '390,844'
const OUT_DIR = path.resolve('.smoke')
const PROFILE_DIR = path.resolve('.smoke-profile')

const TEACHER_ID = 900005
const STUDENT_ID = 900006
const LAB_TITLE = `Стенд: закон Ома ${Date.now().toString().slice(-5)}`

const steps = []

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`)
  }

  return response.status === 204 ? null : response.json()
}

async function prepareData() {
  const teacher = await apiRequest('/auth/dev-login', {
    method: 'POST',
    body: { max_user_id: TEACHER_ID, role: 'teacher' },
  })
  const student = await apiRequest('/auth/dev-login', {
    method: 'POST',
    body: { max_user_id: STUDENT_ID, role: 'student' },
  })

  await apiRequest('/auth/me', {
    method: 'PATCH',
    token: student.access_token,
    body: { school: 'Школа', class_number: 8 },
  })

  let room = (await apiRequest('/classrooms/', { token: teacher.access_token }))[0]

  if (!room) {
    room = await apiRequest('/classrooms/', {
      method: 'POST',
      token: teacher.access_token,
      body: { grade: 8, school: 'Школа' },
    })
  }

  for (const attempt of await apiRequest('/attempts/', { token: student.access_token })) {
    await apiRequest(`/attempts/${attempt.id}`, { method: 'DELETE', token: student.access_token })
  }

  return { teacher, student, room }
}

class Cdp {
  constructor(socket) {
    this.socket = socket
    this.id = 0
    this.pending = new Map()
    this.exceptions = []
    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data)
      if (payload.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(payload.params.exceptionDetails.exception?.description ?? 'exception')
      }
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id)
        this.pending.delete(payload.id)
        if (payload.error) reject(new Error(payload.error.message))
        else resolve(payload.result)
      }
    })
  }

  send(method, params = {}) {
    this.id += 1
    const id = this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
}

const visibleText = `(() => document.body.innerText || '')()`

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  await rm(PROFILE_DIR, { recursive: true, force: true })
  await mkdir(PROFILE_DIR, { recursive: true })

  const prepared = await prepareData()
  steps.push({
    name: 'api-setup',
    result: `учитель и ученик готовы, класс «${prepared.room.label}»`,
  })

  const chrome = process.env.CHROME_PATH ?? findChrome()
  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      `--window-size=${VIEWPORT}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  try {
    await waitForDevtools()
    const target = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(TARGET)}`, {
      method: 'PUT',
    }).then((response) => response.json())

    const socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })

    const cdp = new Cdp(socket)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')

    const shot = async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
      await writeFile(path.join(OUT_DIR, `${name}.png`), Buffer.from(data, 'base64'))
    }

    const clickText = async (text, selector = 'button') => {
      return cdp.evaluate(`
(() => {
  const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
  const hit = nodes.find((node) => (node.innerText || '').trim().includes(${JSON.stringify(text)}));
  if (!hit) return 'NOT_FOUND: ' + ${JSON.stringify(text)};
  hit.click();
  return 'ok';
})()`)
    }

    const waitText = async (text, timeoutMs = 20000) => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const text2 = await cdp.evaluate(visibleText)
        if ((text2 ?? '').includes(text)) return true
        await sleep(200)
      }
      return false
    }

    const enterAs = async (role) => {
      const userId = role === 'teacher' ? TEACHER_ID : STUDENT_ID

      await cdp.evaluate(`
(async () => {
  const response = await fetch('${API}/auth/dev-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ max_user_id: ${userId}, role: '${role}' }),
  });

  const data = await response.json();
  localStorage.setItem('vlr.session.v1', JSON.stringify({ token: data.access_token, user: data.user }));
  return 'ok';
})()`)
      await cdp.send('Page.reload')
      await sleep(2500)
    }

    await enterAs('teacher')

    steps.push({ name: '01-app-loaded', result: (await waitText('Работы')) ? 'каталог открылся' : 'КАТАЛОГ НЕ ОТКРЫЛСЯ' })
    await shot('01-catalog')

    await clickText('Работы')
    await sleep(600)
    await clickText('Создать')
    await sleep(1200)

    steps.push({ name: '02-builder-open', result: (await waitText('Стенд')) ? 'конструктор открылся' : 'КОНСТРУКТОР НЕ ОТКРЫЛСЯ' })
    await shot('02-builder')

    await clickText('Стенд')
    await sleep(600)

    await clickText('Источник питания')
    await sleep(400)
    await clickText('Резистор')
    await sleep(400)
    await clickText('Амперметр')
    await sleep(600)

    const placed = await cdp.evaluate(`
(() => {
  const svg = document.querySelector('svg[aria-label="Стенд"]');
  return svg ? svg.querySelectorAll('rect').length : -1;
})()`)
    steps.push({ name: '03-components-placed', result: placed > 3 ? `компонентов на полотне: ${placed}` : 'КОМПОНЕНТЫ НЕ ПОСТАВЛЕНЫ' })
    await shot('03-stand')

    const connect = async (from, to) => {
      return cdp.evaluate(`
(() => {
  const find = (component, terminal) =>
    document.querySelector('svg[aria-label="Стенд"] circle[data-component="' + component + '"][data-terminal="' + terminal + '"]');

  const tap = (node) => {
    const box = node.getBoundingClientRect();
    node.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2,
    }));
  };

  const first = find(${JSON.stringify(from.component)}, ${JSON.stringify(from.terminal)});
  const second = find(${JSON.stringify(to.component)}, ${JSON.stringify(to.terminal)});
  if (!first || !second) return 'КЛЕММА НЕ НАЙДЕНА';

  tap(first);
  tap(second);
  return 'нажато';
})()`)
    }

    const components = await cdp.evaluate(`
(() => {
  const svg = document.querySelector('svg[aria-label="Стенд"]');
  if (!svg) return [];
  return [...new Set([...svg.querySelectorAll('circle[data-role="terminal"]')].map((node) => node.getAttribute('data-component')))];
})()`)

    steps.push({
      name: '04-terminals',
      result: `клеммы на полотне у ${components.length} приборов`,
    })

    await connect({ component: components[0], terminal: 'right' }, { component: components[1], terminal: 'left' })
    await sleep(500)
    await connect({ component: components[1], terminal: 'right' }, { component: components[2], terminal: 'left' })
    await sleep(600)

    const wires = await cdp.evaluate(
      `document.querySelectorAll('svg[aria-label="Стенд"] path[data-role="wire"]').length`,
    )

    steps.push({
      name: '05-wires-created',
      result: wires >= 2 ? `проводов на стенде: ${wires}` : `ПРОВОДА НЕ СОЗДАНЫ: ${wires}`,
    })
    await shot('03b-wires')

    await clickText('Журнал')
    await sleep(600)
    await clickText('Добавить столбец расчёта')
    await sleep(400)
    await shot('04-journal')

    const journal = await cdp.evaluate(visibleText)
    steps.push({
      name: '07-journal',
      result: (journal ?? '').includes('Журнал работы') ? 'журнал настраивается' : 'ЖУРНАЛ НЕ НАЙДЕН',
    })

    await clickText('Классы')
    await sleep(500)
    await clickText('Всем')
    await sleep(400)

    const audienceText = (await cdp.evaluate(visibleText)) ?? ''
    steps.push({
      name: '07b-audience',
      result: audienceText.includes('каталоге у всех') ? 'работа публикуется для всех' : 'АУДИТОРИЯ НЕ ВЫБРАНА',
    })

    await clickText('Основное')
    await sleep(500)

    await cdp.evaluate(`
(() => {
  const input = document.querySelector('input');
  if (!input) return 'нет поля';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(LAB_TITLE)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`)
    await sleep(400)

    await clickText('Опубликовать')
    await sleep(2500)

    const published = (await cdp.evaluate(visibleText)) ?? ''
    const issues = await cdp.evaluate(`
(() => {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return '';
  return (dialog.innerText || '').split('\\n').filter(Boolean).slice(0, 4).join(' | ');
})()`)

    steps.push({
      name: '08-published',
      result: published.includes('Стенд: закон Ома')
        ? 'работа опубликована и видна в каталоге'
        : `РАБОТА НЕ ОПУБЛИКОВАНА: ${issues || published.slice(0, 160)}`,
    })
    await shot('05-published')

    const exceptions = cdp.exceptions
    steps.push({ name: '09-console', result: exceptions.length === 0 ? 'ошибок нет' : exceptions.join(' | ') })

    await enterAs('student')

    await clickText('Работы')
    await sleep(1000)
    await clickText('Публичные')
    await sleep(1200)

    const studentSees = (await cdp.evaluate(visibleText)) ?? ''
    steps.push({
      name: '10-student-sees-lab',
      result: studentSees.includes('Стенд: закон Ома') ? 'ученик видит опубликованную работу' : 'РАБОТА НЕ ВИДНА УЧЕНИКУ',
    })

    await clickText('Стенд: закон Ома')
    await sleep(1200)
    await shot('06-mode')

    await clickText('Рабочий режим')
    await sleep(1500)

    const runScreen = (await cdp.evaluate(visibleText)) ?? ''
    steps.push({
      name: '11-lab-opened',
      result: runScreen.includes('Старт') ? 'экран работы открылся' : 'ЭКРАН РАБОТЫ НЕ ОТКРЫЛСЯ',
    })
    await shot('07-run')

    await clickText('Старт')
    await sleep(2200)

    const onRun = (await cdp.evaluate(visibleText)) ?? ''
    steps.push({
      name: '12-running',
      result: onRun.includes('Стоп') ? 'опыт идёт: показания считаются' : 'ОПЫТ НЕ ЗАПУСТИЛСЯ',
    })
    await shot('08-running')

    await clickText('Записать')
    await sleep(800)

    const filledManual = await cdp.evaluate(`
(() => {
  const input = document.querySelector('table input');
  if (!input) return 'НЕТ РУЧНОГО СТОЛБЦА';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '12');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'заполнен';
})()`)
    await sleep(500)

    const journalRows = await cdp.evaluate(`
(() => {
  const rows = [...document.querySelectorAll('table tr')];
  return rows.length;
})()`)
    steps.push({
      name: '13-recorded',
      result: `строк в журнале: ${Math.max(journalRows - 1, 0)}, ручной столбец: ${filledManual}`,
    })
    await shot('09-journal-row')

    await clickText('Завершить')
    await sleep(900)

    await cdp.evaluate(`
(() => {
  const area = document.querySelector('textarea');
  if (!area) return 'нет поля';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(area, 'Ток растёт с напряжением, закон Ома выполняется');
  area.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`)
    await sleep(500)

    const submitState = await cdp.evaluate(`
(() => {
  const buttons = [...document.querySelectorAll('[role="dialog"] button')];
  const submit = buttons.find((node) => (node.innerText || '').includes('Отправить учителю'));
  if (!submit) return 'КНОПКА НЕ НАЙДЕНА';
  return submit.disabled ? 'КНОПКА ЗАБЛОКИРОВАНА' : 'кнопка активна';
})()`)

    await clickText('Отправить учителю')
    await sleep(3000)

    const savedAttempts = await cdp.evaluate(`
(async () => {
  const raw = localStorage.getItem('vlr.session.v1');
  const token = raw ? JSON.parse(raw).token : null;
  if (!token) return 'НЕТ ТОКЕНА';

  const response = await fetch('${API}/attempts/', { headers: { authorization: 'Bearer ' + token } });
  const list = await response.json();
  return Array.isArray(list) ? list.length : -1;
})()`)

    steps.push({
      name: '14-submitted',
      result: Number(savedAttempts) > 0
        ? `сдача сохранена на сервере: ${savedAttempts}`
        : `СДАЧА НЕ СОХРАНЕНА (${submitState}, на сервере ${savedAttempts})`,
    })
    await shot('10-submitted')

    await enterAs('teacher')

    await clickText('Проверка')
    await sleep(2500)

    const teacherSees = (await cdp.evaluate(visibleText)) ?? ''
    steps.push({
      name: '15-teacher-sees-attempt',
      result: teacherSees.includes('Стенд: закон Ома') ? 'сдача видна учителю' : 'СДАЧА НЕ ВИДНА УЧИТЕЛЮ',
    })
    await shot('11-teacher')

    steps.push({
      name: '16-console',
      result: cdp.exceptions.length === 0 ? 'ошибок нет' : cdp.exceptions.join(' | '),
    })
  } finally {
    child.kill()
  }

  console.log('\nШаги:')
  for (const step of steps) console.log(`  ${step.name}: ${step.result}`)
  console.log(`\nСкриншоты: ${OUT_DIR}`)
}

function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }

  throw new Error('Chrome не найден: укажите CHROME_PATH')
}

async function waitForDevtools(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`)
      return
    } catch {
      await sleep(200)
    }
  }

  throw new Error('Chrome не отвечает')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
