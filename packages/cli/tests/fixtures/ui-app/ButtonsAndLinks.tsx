import React from 'react';
import { Link, NavLink } from 'react-router-dom';

function t(key: string) { return key; }

export const ButtonsAndLinks = () => {
  const dynamicHref = '/user/' + 123;
  return (
    <div>
      <button>Submit</button>
      <Button>Cancel</Button>
      <button>{t('login.button')}</button>
      
      <a href="/home">Home</a>
      <Link to="/about">About Us</Link>
      <NavLink to={dynamicHref}>{t('profile.link')}</NavLink>
    </div>
  );
};

// Mock Custom Button component to test capital 'Button'
const Button = ({ children }: any) => <button>{children}</button>;
