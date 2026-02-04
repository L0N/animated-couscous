/**
 * Admin Navigation Component
 * 
 * Sidebar navigation for admin interface with active state management.
 * Provides navigation to all admin sections and logout functionality.
 * 
 * Features:
 * - Active route highlighting
 * - Icon-based navigation
 * - Logout functionality
 * - Responsive design
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { 
  HomeIcon, 
  DocumentTextIcon, 
  UsersIcon, 
  ChartBarIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: HomeIcon,
  },
  {
    name: 'Loans',
    href: '/admin/loans',
    icon: DocumentTextIcon,
  },
  {
    name: 'Customers',
    href: '/admin/customers',
    icon: UsersIcon,
  },
  {
    name: 'Reports',
    href: '/admin/reports',
    icon: ChartBarIcon,
  },
];

export default function AdminNavigation() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <nav className="h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">WP</span>
          </div>
          <span className="ml-3 text-lg font-semibold text-gray-900">
            WanPaus
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Admin Portal</p>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </nav>
  );
}
