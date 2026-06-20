// ---------------------------------------------------------------------------
// createBrowserRouter data-API fixture (6 route capabilities expected)
//
// Routes:
//  /blog                      → flat
//  /blog/:slug                → dynamic, nested child of /blog
//  /blog/:slug/comments       → dynamic, nested grandchild
//  /products/:category/:id    → two dynamic params, flat
//  /dashboard                 → flat
//  /dashboard/analytics       → nested child of /dashboard
// ---------------------------------------------------------------------------

import { createBrowserRouter } from 'react-router-dom';

function BlogList() { return null; }
function BlogPost() { return null; }
function BlogComments() { return null; }
function ProductDetail() { return null; }
function Dashboard() { return null; }
function Analytics() { return null; }

export const router = createBrowserRouter([
  {
    path: '/blog',
    element: <BlogList />,
    children: [
      {
        path: ':slug',
        element: <BlogPost />,
        children: [
          {
            path: 'comments',
            element: <BlogComments />,
          },
        ],
      },
    ],
  },
  {
    path: '/products/:category/:id',
    element: <ProductDetail />,
  },
  {
    path: '/dashboard',
    element: <Dashboard />,
    children: [
      {
        path: 'analytics',
        element: <Analytics />,
      },
    ],
  },
]);

export default router;
