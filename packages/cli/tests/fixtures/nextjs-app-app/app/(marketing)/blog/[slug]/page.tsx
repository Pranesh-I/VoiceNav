// Route group: (marketing) — stripped from URL path
// Dynamic segment: [slug]
// This file produces route: /blog/:slug
export default function BlogPostPage({ params }: { params: { slug: string } }) {
  return <main><h1>Post: {params.slug}</h1></main>;
}
