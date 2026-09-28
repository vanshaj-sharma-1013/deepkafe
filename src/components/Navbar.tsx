import Link from "next/link";
import { Search } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b-4 border-sky-300 bg-[#3b6ea5] shadow-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-white">
          <Search size={22} />
          DeepFake & Image Tampering Detector
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium text-sky-100">
          <Link href="/" className="transition-colors hover:text-white">
            Dashboard
          </Link>
          <Link
            href="/test"
            className="rounded-md bg-[#2f5c8a] px-4 py-2 text-white transition-colors hover:bg-[#264b71]"
          >
            Testing Workbench
          </Link>
        </div>
      </nav>
    </header>
  );
}
