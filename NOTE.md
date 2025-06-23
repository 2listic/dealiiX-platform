## First Steps

- Configuration of a local server on my PC, an endpoint `/alive_local` (FastAPI)
- Configuration of a remote server with endpoint `/alive_remote` (FastAPI)
- Configuration of a client application using Electron and SvelteFlow that will make SSH connections to a cluster and send data to the remote server

The main objective of this initial end-to-end test is to test the client application, which should be able to:

- Make SSH connections to different nodes in the cluster from the local machine.
- Send data obtained from the cluster to a remote server.
