import "./globals.css";
export const metadata = { title: "FFEX License", description: "FFEX License Management" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
