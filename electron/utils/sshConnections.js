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

/**
 * @param {string} command
 * @param {{ host: string, port: number, username: string, pathToSsh: string }} connection
 * @returns {Promise<string>}
 */
function connectToSSHWithKey(command, connection) {
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

/**
 * @param {string} content
 * @param {string} remotePath
 * @param {{ host: string, port: number, username: string, pathToSsh: string }} connection
 * @returns {Promise<string>}
 */
function uploadFileViaSftp(content, remotePath, connection) {
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
