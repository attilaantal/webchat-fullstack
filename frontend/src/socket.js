import { io } from 'socket.io-client'

const URL = 'http://localhost:4000'
const socket = io(URL, { withCredentials: true, autoConnect: false })

export function connect() { if (!socket.connected) socket.connect(); }
export default socket
