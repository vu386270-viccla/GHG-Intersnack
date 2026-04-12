export default function LoginLayout({ children }: { children: React.ReactNode }) {
  // Layout riêng cho /login — không có Sidebar, Header
  return <>{children}</>;
}
