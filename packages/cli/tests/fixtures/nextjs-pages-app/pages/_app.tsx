// Next.js internal — must NOT produce a route capability
import type { AppProps } from 'next';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
