import React, { useState } from 'react'
import axios from 'axios'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const doRegister = async () => {
    try {
      await axios.post('/api/register', { username, password });
      alert('Registered — you can now login');
    } catch (e) { alert('Register failed'); }
  }

  const doLogin = async () => {
    try {
      const res = await axios.post('/api/login', { username, password });
      onLogin(res.data);
    } catch (e) { alert('Login failed'); }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-base-100 rounded-lg shadow">
      <h2 className="text-2xl mb-4">Login / Register</h2>
      <div className="mb-2">
        <input className="input input-bordered w-full" placeholder="username" value={username} onChange={e => setUsername(e.target.value)} />
      </div>
      <div className="mb-4">
        <input className="input input-bordered w-full" placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={doLogin}>Login</button>
        <button className="btn" onClick={doRegister}>Register</button>
      </div>
    </div>
  )
}
