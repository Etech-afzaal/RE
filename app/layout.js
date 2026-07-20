import Providers from "./providers";
import "./globals.css";

export const metadata = {
  title: "Dhalahore Properties",
  description: "Find your next property in Lahore.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
