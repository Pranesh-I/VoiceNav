import type { GetServerSideProps } from 'next';

interface Props { slug: string[]; }

export default function DocsPage({ slug }: Props) {
  return <main><h1>Docs: {slug?.join('/')}</h1></main>;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => ({
  props: { slug: params?.slug as string[] },
});
