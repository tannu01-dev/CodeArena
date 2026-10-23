
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata = {
  title: "CodeArena | Coding Assessments",
  description:
    "A professional platform for coding assessments, technical hiring and developer evaluation."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
