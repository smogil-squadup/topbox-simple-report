"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="flex justify-between items-center p-4 bg-gray-100 border-b">
      <div className="flex items-center gap-8">
        <h1 className="text-xl font-bold">Topbox Reporting</h1>
        <SignedIn>
          <nav className="flex gap-4">
            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/dashboard"
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-200"
              }`}>
              Dashboard
            </Link>
            <Link
              href="/dashboard/recipients"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/dashboard/recipients"
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-200"
              }`}>
              Recipients
            </Link>
            <Link
              href="/dashboard/schedule"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/dashboard/schedule"
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-200"
              }`}>
              Schedule
            </Link>
          </nav>
        </SignedIn>
      </div>
      <div>
        <SignedOut>
          <div className="flex gap-2">
            <SignInButton mode="modal" />
            <SignUpButton mode="modal" />
          </div>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
