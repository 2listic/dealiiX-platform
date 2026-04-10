import { Client } from 'ssh2'
import fs from 'fs'

function connectToSSHWithPassword(host, username, password, command) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn
      .on('ready', () => {
        console.log('SSH Connection with password established')

        conn.exec(command, (err, stream) => {
          if (err) reject(err)
          let data = ''
          stream
            .on('close', (code) => {
              console.log('Command completed with code', code)
              conn.end()
              resolve(data)
            })
            .on('data', (chunk) => {
              console.log('STDOUT:', chunk.toString())
              data += chunk
            })
            .stderr.on('data', (chunk) => {
              console.log('STDERR:', chunk.toString())
              data += chunk
            })
        })
      })
      .on('error', (err) => {
        console.error('SSH Connection error')
        reject(err)
      })
      .connect({
        host,
        port: 5050,
        username,
        password,
      })
  })
}

const normalizeKeyConnection = (connectionOrPath) => {
  if (typeof connectionOrPath === 'string') {
    return {
      host: 'localhost',
      port: 2222,
      username: 'root',
      pathToSsh: connectionOrPath,
    }
  }

  return {
    host: connectionOrPath.host ?? 'localhost',
    port: connectionOrPath.port ?? 2222,
    username: connectionOrPath.username ?? 'root',
    pathToSsh: connectionOrPath.pathToSsh,
  }
}

function connectToSSHWithKey(command, connectionOrPath) {
  const connection = normalizeKeyConnection(connectionOrPath)
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn
      .on('ready', () => {
        console.log('SSH Connection with key established')

        conn.exec(command, (err, stream) => {
          if (err) return reject(err)

          let data = ''
          stream
            .on('close', (code) => {
              console.log('Command completed with code', code)
              conn.end()
              resolve(data)
            })
            .on('data', (chunk) => {
              console.log('STDOUT:', chunk.toString())
              data += chunk
            })
            .stderr.on('data', (chunk) => {
              console.log('STDERR:', chunk.toString())
              data += chunk
            })
        })
      })
      .on('error', (err) => {
        console.error('SSH Connection error')
        reject(err)
      })
      .connect({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        privateKey: fs.readFileSync(connection.pathToSsh),
        debug: console.log,
        // hostVerifier: (keyHash) => {  // consider hashing the private key
        //   return true
        // },
        readyTimeout: 5000, // additional options
        keepaliveInterval: 10000,
      })
  })
}

function uploadFileViaSftp(content, remotePath, connectionOrPath) {
  const connection = normalizeKeyConnection(connectionOrPath)
  return new Promise((resolve, reject) => {
    console.log('uploadFileViaSftp called')
    const conn = new Client()
    conn
      .on('ready', () => {
        console.log('SSH Connection with key established')
        conn.sftp((err, sftp) => {
          if (err) return reject(err)
          sftp.writeFile(remotePath, content, (err) => {
            if (err) {
              conn.end()
              return reject(err)
            }
            console.log('File uploaded successfully')
            conn.end()
            resolve(`File uploaded to: ${remotePath}`)
          })
        })
      })
      .on('error', (err) => {
        console.error('SFTP Connection error')
        reject(err)
      })
      .connect({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        privateKey: fs.readFileSync(connection.pathToSsh),
        debug: console.log,
      })
  })
}

export { connectToSSHWithPassword, connectToSSHWithKey, uploadFileViaSftp }
