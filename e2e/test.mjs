import puppeteer from 'puppeteer';

const SERVICE_TYPE_PASSPORT = '2'

const BASE_DOC_PASSPORT = '1'
const BASE_DOC_ID = '2'

const DOC_STATUS_SEND = 21  // Відправлено до центру до Персоналізації
const DOC_STATUS_IN_TRANSIT = 23 // Документ в дорозі до ДП Документ
const DOC_STATUS_READY = 24 // Готовий до видачі, приїхав

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'

const passportid = '006408762'

const createAwaiter = () => {
  let waitCtx = null
  const awaiter = new Promise((resolve, reject) => {
    waitCtx = { resolve, reject }
  })

  const submitter = (err, result) => {
    if (err) {
      waitCtx.reject(err)
      return
    }

    waitCtx.resolve(result)
  }

  return [awaiter, submitter]
}

const buildFormObject = ({ series, number }) => {
  return {
    'doc_service': SERVICE_TYPE_PASSPORT,
    'doc_1_select': '',
    'doc_1_series': '',
    'doc_1_number6': '',
    'doc_1_number9': '',
    'doc_age': '0',
    'doc_2_select': series ? BASE_DOC_PASSPORT : BASE_DOC_ID,
    'doc_2_series': series || '',
    'doc_2_number6': series ? number : '',
    'doc_2_number9': series ? '' : number,
    'doc_other': '',
  }
}

const main = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    // headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.setUserAgent(UA)

  await page.goto('https://pasport.org.ua/solutions/checker', { waitUntil: 'domcontentloaded' });

  const [waitResult, submitCallback] = createAwaiter()
  await page.exposeFunction('__onResult__', submitCallback)

  const formObject = buildFormObject({ number: passportid })

  // TODO: memorize fetch func
  await page.evaluate((formObject) => {
    const elem = document.querySelector('form[data-jtoken]')
    if (!elem) {
      console.log('token n/a')
      window.__onResult__('ERR_TOKEN_NOT_FOUND')
      return
    }
    const token = elem.getAttribute('data-jtoken')
    if (!token) {
      console.log('token empty')
      window.__onResult__('ERR_TOKEN_EMPTY')
      return
    }

    console.log('token found - ', token)

    const form = new FormData();
    Object.entries(formObject).forEach(([k, v]) => {
      form.append(k, v)
    })
    form.append(token, '1')

    fetch('https://pasport.org.ua/solutions/checker', {
      method: 'POST',
      body: form,
    })
      .then(r => {
        if (r.status !== 200) {
          return Promise.reject(new Error(`${r.status} ${r.statusText}`))
        }

        return r.json()
      })
      .then(r => {
        if (r['0'].errorCode > 1) {
          return Promise.reject(new Error(r.send_status_msg))
        }

        console.log('success', r)
        window.__onResult__(null, r)
      })
      .catch(err => {
        console.log('error', err)
        window.__onResult__(err.message || err.toString() || 'ERR_UNKNOWN')
      })
  }, formObject)

  const result = await waitResult
  console.log(result)
  await browser.close()
}

main().catch(err => {
  console.error(err)
})