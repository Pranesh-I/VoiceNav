import type { GetServerSideProps } from 'next';

interface Props { id: string; }

export default function UserProfilePage({ id }: Props) {
  return <main><h1>User {id} Profile</h1></main>;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => ({
  props: { id: params?.id as string },
});
