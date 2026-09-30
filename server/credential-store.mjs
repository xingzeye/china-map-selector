import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'

export async function createCredentialStore(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const keyPath = path.join(directory, 'encryption.key')
  let key
  try { key = await readFile(keyPath) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    key = randomBytes(32)
    await writeFile(keyPath, key, { mode: 0o600, flag: 'wx' })
  }
  if (key.length !== 32) throw new Error('本机凭据加密密钥损坏。请保留文件并检查备份。')
  const file = path.join(directory, 'credentials.enc')
  let credentials = {}
  try {
    const data = JSON.parse(await readFile(file, 'utf8'))
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(data.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(data.tag, 'base64'))
    credentials = JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.data, 'base64')), decipher.final()]).toString('utf8'))
  } catch (error) { if (error.code !== 'ENOENT') throw new Error('本机凭据无法解密。请保留 credentials.enc 与 encryption.key 并检查备份。') }
  let queue = Promise.resolve()
  async function persist(next) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(next), 'utf8'), cipher.final()])
    const temporary = `${file}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') }), { mode: 0o600 })
    await rename(temporary, file)
    credentials = next
  }
  function serialize(operation) {
    const result = queue.then(operation)
    queue = result.catch(() => {})
    return result
  }
  return {
    read: async id => { await queue; return credentials[id] ? structuredClone(credentials[id]) : undefined },
    list: async () => { await queue; return Object.entries(credentials).map(([providerId, credential]) => ({ providerId, type: credential.type })) },
    modify: (id, fn) => serialize(async () => {
      const current = credentials[id] ? structuredClone(credentials[id]) : undefined
      const updated = await fn(current)
      if (updated !== undefined) await persist({ ...credentials, [id]: updated })
      return updated ?? current
    }),
    delete: id => serialize(async () => { const next = { ...credentials }; delete next[id]; await persist(next) }),
  }
}

export async function installationInfo(directory) {
  const file = path.join(directory, 'installation.json')
  try { return JSON.parse(await readFile(file, 'utf8')) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    const info = { deviceId: randomUUID(), bridgeToken: randomBytes(32).toString('base64url') }
    await writeFile(file, JSON.stringify(info), { mode: 0o600, flag: 'wx' })
    return info
  }
}
