import React from 'react';
import { createBrowserRouter, RouterProvider, Link } from 'react-router-dom';
import { TaskForm } from './TaskForm';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/tasks', element: <TaskList /> },
  { path: '/tasks/:id', element: <TaskForm /> }
]);

export function App() {
  return <RouterProvider router={router} />;
}

function Home() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/tasks">Tasks</Link>
    </nav>
  );
}

function TaskList() {
  const handleDelete = () => { console.log('deleted'); };
  
  return (
    <div>
      <button onClick={handleDelete}>Delete Task</button>
    </div>
  );
}

export function fetchTasks() {
  return fetch('/api/tasks').then(r => r.json());
}
