import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'ProblemMarket — Global Problem & Solution Marketplace',
  description: 'Post real problems with rewards. Compete globally to solve them.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen font-sans antialiased">
        <Navbar />
        <main>{children}</main>
        <footer className="border-t border-gray-200 mt-20 py-8 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} ProblemMarket · 10% platform fee · Building the world's intelligence marketplace
        </footer>
      </body>
    </html>
  );
}
