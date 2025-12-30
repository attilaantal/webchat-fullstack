import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import socket, { connect } from '../socket'

export default function RoomsPage({ user }) {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(new Set());

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    connect();
  }, []);

  useEffect(() => {
    // attempt to probe which rooms this socket has already joined (server returns already:true)
    const probe = async () => {
      rooms.forEach((r) => {
        socket.emit('join_room', r.id, (resp) => {
          if (resp && resp.already) {
            setJoined(prev => new Set([...Array.from(prev), r.id]));
          } else if (resp && resp.ok && !resp.already) {
            // we just joined due to probe; leave to respect user's choice
            socket.emit('leave_room', r.id, () => {});
          }
        });
      });
    }
    if (rooms.length) probe();
  }, [rooms]);

  const fetchRooms = async () => {
    const res = await axios.get('/api/rooms');
    setRooms(res.data.rooms || []);
  }

  const createRoom = async () => {
    if (!name) return;
    try {
      await axios.post('/api/rooms', { name });
      setName('');
      fetchRooms();
    } catch (e) { alert('create failed'); }
  }

  const toggleJoin = (room) => {
    if (joined.has(room.id)) {
      socket.emit('leave_room', room.id, (resp) => {
        if (resp && resp.ok) {
          const n = new Set(joined);
          n.delete(room.id);
          setJoined(n);
        }
      });
    } else {
      socket.emit('join_room', room.id, (resp) => {
        if (resp && resp.ok) {
          setJoined(new Set([...Array.from(joined), room.id]));
        }
      });
    }
  }

  return (
    <div>
      <h2>Rooms</h2>
      <div>
        <input placeholder="new room name" value={name} onChange={e => setName(e.target.value)} />
        <button onClick={createRoom} disabled={!user}>Create</button>
      </div>
      <ul className="mt-4 space-y-2">
        {rooms.map(r => (
          <li key={r.id} className="flex items-center justify-between p-2 border rounded">
            <div>
              <Link className="font-medium" to={`/rooms/${r.id}`}>{r.name}</Link>
            </div>
            <div className="flex gap-2">
              <button className={`btn btn-sm ${joined.has(r.id) ? 'btn-secondary' : 'btn-outline'}`} onClick={() => toggleJoin(r)}>
                {joined.has(r.id) ? 'Leave' : 'Join'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
