export const sleep = (t: number) => new Promise((resolve) => {
  setTimeout(resolve, t)
})

type RetryFunc<T> = () => (PromiseLike<T> | T)

export const retry = <T>(n: number, delay = 1000) => async (fn: RetryFunc<T>) => {
  let lastErr: any
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      await sleep(delay)
    }

    try {
      const r = fn()
      if (r?.['then']) {
        return await r
      }

      return r
    } catch (err) {
      lastErr = err
    }
  }

  throw lastErr
}
