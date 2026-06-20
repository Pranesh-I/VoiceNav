import React from 'react';

// Decoy: A type guard that should NOT be picked up as a handler
export function isSpecialUser(user: any): user is { role: 'admin' } {
  return user && user.role === 'admin';
}

// Decoy: JSX elements with string or boolean onClick (invalid React, but AST allows it)
export function DecoyComponent() {
  return (
    <div>
      <button onClick="hello">Not a handler</button>
      <button onClick={true as any}>Not a handler</button>
      <button onClick={null as any}>Not a handler</button>
    </div>
  );
}
