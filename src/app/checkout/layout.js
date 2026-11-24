// Shopper-private page: keep it out of Google's index (it was served as "index, follow" with the generic site title).
export const metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }) {
  return children;
}
