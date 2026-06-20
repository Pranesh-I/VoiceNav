import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Page components
// ---------------------------------------------------------------------------

function Home() { return <h1>Home</h1>; }
function About() { return <h1>About</h1>; }
function NotFound() { return <h1>404</h1>; }
function Settings() { return <h1>Settings</h1>; }
function UserList() { return <h1>Users</h1>; }
function UserDetail() { return <h1>User Detail</h1>; }
function UserSettings() { return <h1>User Settings</h1>; }
function Login() { return <h1>Login</h1>; }

// ---------------------------------------------------------------------------
// App — JSX route definitions (6 route capabilities expected)
//  /              → Home
//  /about         → About
//  /login         → Login
//  /settings/*    → Settings (wildcard)
//  /users         → UserList          (non-nested parent)
//  /users/:id     → UserDetail        (nested under /users)
//  /users/:id/settings → UserSettings (nested under /users/:id)
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/settings/*" element={<Settings />} />
        <Route path="/users" element={<UserList />}>
          <Route path=":id" element={<UserDetail />}>
            <Route path="settings" element={<UserSettings />} />
          </Route>
        </Route>
        <Route path="/404" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
