import type { GetServerSideProps } from 'next';

interface Props { slug: string; }

export default function BlogPostPage({ slug }: Props) {
  return <main><h1>Post: {slug}</h1></main>;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => ({
  props: { slug: params?.slug as string },
});
