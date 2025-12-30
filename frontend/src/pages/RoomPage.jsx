import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import socket, { connect } from '../socket'
import axios from 'axios'

export default function RoomPage({ user }) {
  const { id } = useParams();
  const roomId = Number(id);
  const [logs, setLogs] = useState([]);
  const [text, setText] = useState('');
  const [joined, setJoined] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const logsRef = useRef([]);

  useEffect(() => {
    axios.get('/api/rooms').then(res => {
      const r = (res.data.rooms || []).find(x => Number(x.id) === roomId);
      setRoomInfo(r);
    });
  }, [roomId]);

  useEffect(() => {
    connect();

    function onMsg(m) {
      if (m.roomId !== roomId) return;
      logsRef.current = [...logsRef.current, `[${new Date(m.time).toLocaleTimeString()}] ${m.user.username}: ${m.text}`];
      setLogs([...logsRef.current]);
    }

    function onUserJoined(u) {
      logsRef.current = [...logsRef.current, `${u.user.username} joined`];
      setLogs([...logsRef.current]);
    }

    function onUserLeft(u) {
      logsRef.current = [...logsRef.current, `${u.user.username} left`];
      setLogs([...logsRef.current]);
    }

    socket.on('msg', onMsg);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);

    // check if already joined via asking server with a join call that returns already:true
    socket.emit('join_room', roomId, (resp) => {
      if (resp && resp.ok) setJoined(true);
      if (resp && resp.already) setJoined(true);
    });

    return () => {
      socket.off('msg', onMsg);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
    }
  }, [roomId]);

  const send = () => {
    if (!text) return;
    socket.emit('msg', { roomId, text });
    setText('');
  }

  const leave = () => {
    socket.emit('leave_room', roomId, (resp) => {
      if (resp && resp.ok) setJoined(false);
    });
  }

  const kick = (targetUserId) => {
    socket.emit('kick', roomId, Number(targetUserId), (resp) => {
      if (resp && resp.error) alert('kick failed: ' + resp.error);
    });
  }

  return (
    <div>
      <h2>Room: {roomInfo ? roomInfo.name : `#${id}`}</h2>
      <div className="border p-2 h-72 overflow-auto mb-2">
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div className="flex gap-2 mb-2">
        <input className="input input-bordered flex-1" value={text} onChange={e => setText(e.target.value)} />
        <button className="btn btn-primary" onClick={send}>Send</button>
        <button className="btn btn-outline" onClick={leave} disabled={!joined}>Leave</button>
      </div>
      <div>
        <h4>Admin</h4>
        <div>Kick user by id (demo): <button className="btn btn-sm btn-error ml-2" onClick={() => kick(prompt('target user id'))}>Kick</button></div>
      </div>
    </div>
  )
}
