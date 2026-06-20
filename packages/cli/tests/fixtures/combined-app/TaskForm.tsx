import React from 'react';

export function TaskForm() {
  const handleSubmit = (e: any) => { e.preventDefault(); };

  return (
    <form onSubmit={handleSubmit}>
      <h1>TaskForm</h1>
      <label>
        Task Title
        <input type="text" name="title" />
      </label>
      <label>
        Task Description
        <textarea name="desc" />
      </label>
      <button type="submit">Save Task</button>
    </form>
  );
}

export const createTask = async (data: any) => {
  return fetch('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
};
