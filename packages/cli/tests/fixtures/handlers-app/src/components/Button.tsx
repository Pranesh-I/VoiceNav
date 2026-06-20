import React from 'react';
import { findUser1 } from '../services/UserService';

export function Button({ onAction1, onAction2 }: { onAction1: any, onAction2: any }) {
  const handleClick1 = () => {};
  const handleClick2 = () => {};
  const handleClick3 = function() {};

  return (
    <div>
      <button onClick={handleClick1}>1</button>
      <button onClick={handleClick2}>2</button>
      <button onClick={handleClick3}>3</button>
      
      <button onClick={onAction1}>4</button>
      <button onClick={onAction2}>5</button>
      
      <button onClick={() => console.log('6')}>6</button>
      <button onClick={(e) => console.log('7')}>7</button>
      <button onClick={() => { console.log('8'); }}>8</button>
      
      <button onClick={function(e) { console.log('9'); }}>9</button>
      <button onClick={function(e) { console.log('10'); }}>10</button>
      
      {/* Service function wired as onClick */}
      <button onClick={findUser1}>11</button>
    </div>
  );
}
