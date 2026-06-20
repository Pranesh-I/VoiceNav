import React from 'react';

interface Props {
  name: string;
  count?: number;
}

/**
 * A simple valid TSX component used as a parse-success fixture.
 */
export const SimpleComponent: React.FC<Props> = ({ name, count = 0 }) => {
  const handleClick = () => {
    console.log(`Clicked: ${name} (${count})`);
  };

  return (
    <div className="simple-component">
      <h2>{name}</h2>
      <button onClick={handleClick} type="button">
        Click me ({count})
      </button>
    </div>
  );
};

export default SimpleComponent;
