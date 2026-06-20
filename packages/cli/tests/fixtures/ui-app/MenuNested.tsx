import React from 'react';

export const MenuNested = () => {
  return (
    <nav>
      <MainMenu id="main-nav">
        <MenuItem>Dashboard</MenuItem>
        <MenuItem>Settings</MenuItem>
        
        <ProfileDropdown>
          <DropdownItem>My Profile</DropdownItem>
          <DropdownItem>Logout</DropdownItem>
        </ProfileDropdown>
      </MainMenu>
    </nav>
  );
};

const MainMenu = ({ children, id }: any) => <ul id={id}>{children}</ul>;
const MenuItem = ({ children }: any) => <li>{children}</li>;
const ProfileDropdown = ({ children }: any) => <ul>{children}</ul>;
const DropdownItem = ({ children }: any) => <li>{children}</li>;
