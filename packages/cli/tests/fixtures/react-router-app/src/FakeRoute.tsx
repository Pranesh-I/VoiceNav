// ---------------------------------------------------------------------------
// FALSE-POSITIVE FIXTURE
//
// This file is designed to trip up naive route detectors.
// It must produce ZERO route capabilities from A1 discovery.
//
// Traps contained:
//   1. A styled-component (function) named "Route" — NOT imported from react-router
//   2. A string variable named "path" with a route-like value
//   3. A function call "routeTo('/about')" that resembles route configuration
//   4. An object with a "path" key that is NOT inside createBrowserRouter
//   5. A comment mentioning <Route path="/fake" />
// ---------------------------------------------------------------------------

// No react-router import — this is the primary false-positive guard.
import styled from 'styled-components'; // hypothetical, not actually installed

// Trap 1: a styled component coincidentally named "Route"
const Route = styled.div`
  display: flex;
  flex-direction: row;
`;

// Trap 2: path-like string — not a route definition
const path = '/blog/:slug';
const anotherPath = '/users/:id/profile';

// Trap 3: a function that navigates, not a route definition
function routeTo(destination: string) {
  console.log(`Navigating to ${destination}`);
}

routeTo('/about');
routeTo('/settings');

// Trap 4: plain object with "path" key — NOT inside createBrowserRouter
const pageConfig = {
  path: '/dashboard',
  title: 'Dashboard',
  icon: 'grid',
};

const menuItems = [
  { path: '/home', label: 'Home' },
  { path: '/profile', label: 'Profile' },
];

// Trap 5 (in comment): <Route path="/fake" element={<FakePage />} />
// The above line in a comment must not be parsed as a route.

export { Route, path, routeTo, pageConfig, menuItems };
