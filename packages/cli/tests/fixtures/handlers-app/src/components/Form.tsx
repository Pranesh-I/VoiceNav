import React from 'react';

export function Form() {
  const handleSubmit1 = (e: React.FormEvent) => e.preventDefault();
  const handleSubmit2 = function(e: React.FormEvent) { e.preventDefault(); };

  return (
    <div>
      <form onSubmit={handleSubmit1}></form>
      <form onSubmit={handleSubmit2}></form>
      <form onSubmit={(e) => { e.preventDefault(); }}></form>
      <form onSubmit={(e) => e.preventDefault()}></form>
      <form onSubmit={function(e) { e.preventDefault(); }}></form>
    </div>
  );
}
