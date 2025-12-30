import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import LoginPage from './pages/LoginPage'
import RoomsPage from './pages/RoomsPage'
import RoomPage from './pages/RoomPage'

axios.defaults.withCredentials = true;
axios.defaults.baseURL = 'http://localhost:4000';

export default function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/me').then(res => setUser(res.data.user)).catch(() => {});
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <header>
        <h1>WebChat</h1>
        <nav>
          { user && <Link to="/rooms">Rooms</Link> }
          {' '}
          {user ? <span>Welcome {user.username}</span> : <Link to="/login">Login</Link>}
        </nav>
      </header>

      <Routes>
        <Route path="/login" element={<LoginPage onLogin={u => { setUser(u); navigate('/rooms'); }} />} />
        <Route path="/rooms" element={user ? <RoomsPage user={user} /> : <LoginPage onLogin={u => { setUser(u); navigate('/rooms'); }} />} />
        <Route path="/rooms/:id" element={user ? <RoomPage user={user} /> : <LoginPage onLogin={u => { setUser(u); navigate('/rooms'); }} />} />
        <Route path="/" element={user ? <RoomsPage user={user} /> : <LoginPage onLogin={u => { setUser(u); navigate('/rooms'); }} />} />
      </Routes>
    </div>
  )
}
